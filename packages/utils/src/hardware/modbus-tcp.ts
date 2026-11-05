import { EventEmitter } from 'node:events';
import net from 'node:net';

export interface ModbusTcpOptions {
  host: string;
  port: number;
  unitId?: number;
  timeout?: number;
}

interface PendingRequest {
  resolve: (value: Buffer) => void;
  reject: (reason?: unknown) => void;
  timer: NodeJS.Timeout;
}

/**
 * Modbus TCP client for interfacing with industrial PLCs, SCADA telemetry, and drill rigs.
 * Implements function code 03 (Read Holding Registers) over Modbus TCP.
 */
export class ModbusTcpClient extends EventEmitter {
  private host: string;
  private port: number;
  private unitId: number;
  private socket: net.Socket | null = null;
  private timeout: number;
  private transactionId = 0;
  private pending = new Map<number, PendingRequest>();
  private responseBuffer = Buffer.alloc(0);

  constructor(options: ModbusTcpOptions) {
    super();
    this.host = options.host;
    this.port = options.port;
    this.unitId = options.unitId ?? 1;
    this.timeout = options.timeout ?? 5000;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        this.emit('connected');
        resolve();
      });

      this.socket.setTimeout(this.timeout);

      this.socket.on('error', (err) => {
        this.emit('error', err);
        this.failAllPending(err);
        reject(err);
      });

      this.socket.on('timeout', () => {
        const err = new Error('Modbus TCP connection timeout');
        this.emit('error', err);
        this.failAllPending(err);
        this.socket?.destroy();
        reject(err);
      });

      this.socket.on('data', (data) => {
        this.responseBuffer = Buffer.concat([this.responseBuffer, data]);
        this.processResponseBuffer();
      });

      this.socket.on('close', () => {
        this.emit('disconnected');
        this.socket = null;
        this.failAllPending(new Error('Socket closed'));
      });
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
    this.failAllPending(new Error('Client disconnected'));
  }

  /**
   * Builds a Modbus TCP ADU for Read Holding Registers (function code 03).
   */
  private buildReadHoldingRegistersRequest(startAddress: number, quantity: number): Buffer {
    this.transactionId = (this.transactionId + 1) % 65535;
    const pduLength = 5; // function code (1) + start address (2) + quantity (2)
    const length = 1 + pduLength; // unit ID (1) + PDU

    const buf = Buffer.alloc(7 + pduLength); // MBAP header (7) + PDU
    buf.writeUInt16BE(this.transactionId, 0); // Transaction ID
    buf.writeUInt16BE(0, 2); // Protocol ID (0 = Modbus)
    buf.writeUInt16BE(length, 4); // Length
    buf.writeUInt8(this.unitId, 6); // Unit ID
    buf.writeUInt8(0x03, 7); // Function code: Read Holding Registers
    buf.writeUInt16BE(startAddress, 8); // Starting address
    buf.writeUInt16BE(quantity, 10); // Quantity of registers
    return buf;
  }

  /**
   * Parses a Modbus TCP Read Holding Registers response.
   */
  private parseReadHoldingRegistersResponse(
    response: Buffer,
    expectedTransactionId: number
  ): Buffer {
    if (response.length < 9) {
      throw new Error(`Modbus response too short: ${response.length} bytes`);
    }

    const transactionId = response.readUInt16BE(0);
    const protocolId = response.readUInt16BE(2);
    const _length = response.readUInt16BE(4);
    const unitId = response.readUInt8(6); // Unit ID is 1 byte at offset 6
    const functionCode = response.readUInt8(8);

    if (transactionId !== expectedTransactionId) {
      throw new Error(
        `Modbus transaction ID mismatch: expected ${expectedTransactionId}, got ${transactionId}`
      );
    }
    if (protocolId !== 0) {
      throw new Error(`Modbus protocol ID mismatch: expected 0, got ${protocolId}`);
    }
    if (unitId !== this.unitId) {
      throw new Error(`Modbus unit ID mismatch: expected ${this.unitId}, got ${unitId}`);
    }

    // Exception response: function code has high bit set
    if (functionCode & 0x80) {
      const exceptionCode = response.readUInt8(9);
      throw new Error(
        `Modbus exception: function code 0x${functionCode.toString(16)}, exception code 0x${exceptionCode.toString(16)}`
      );
    }
    if (functionCode !== 0x03) {
      throw new Error(`Modbus unexpected function code: 0x${functionCode.toString(16)}`);
    }

    const byteCount = response.readUInt8(9);
    const registerData = response.subarray(10, 10 + byteCount);

    if (registerData.length !== byteCount) {
      throw new Error(
        `Modbus response truncated: expected ${byteCount} bytes of register data, got ${registerData.length}`
      );
    }

    return registerData;
  }

  private failAllPending(reason?: unknown): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pending.clear();
  }

  private processResponseBuffer(): void {
    while (this.responseBuffer.length >= 7) {
      // Need at least MBAP header (7 bytes) to read length
      const length = this.responseBuffer.readUInt16BE(4);
      const totalFrameSize = 7 + length; // MBAP header (7) + length field value

      if (this.responseBuffer.length < totalFrameSize) {
        break; // Incomplete frame, wait for more data
      }

      const frame = this.responseBuffer.subarray(0, totalFrameSize);
      this.responseBuffer = this.responseBuffer.subarray(totalFrameSize);

      const transactionId = frame.readUInt16BE(0);
      const pending = this.pending.get(transactionId);

      if (!pending) {
        // Response for a transaction we don't have pending; skip
        continue;
      }

      clearTimeout(pending.timer);
      this.pending.delete(transactionId);

      try {
        const registerData = this.parseReadHoldingRegistersResponse(frame, transactionId);
        pending.resolve(registerData);
      } catch (err) {
        pending.reject(err);
      }
    }
  }

  /**
   * Reads holding registers from the Modbus device using function code 03.
   * Returns raw register data as a Buffer (2 bytes per register, big-endian).
   */
  public async readHoldingRegisters(startAddress: number, quantity: number): Promise<Buffer> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    if (quantity < 1 || quantity > 125) {
      throw new Error(`Invalid register quantity: ${quantity} (must be 1-125)`);
    }

    const request = this.buildReadHoldingRegistersRequest(startAddress, quantity);
    const tid = this.transactionId;

    const promise = new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(tid);
        reject(new Error(`Modbus TCP read timeout for transaction ${tid}`));
      }, this.timeout);

      this.pending.set(tid, { resolve, reject, timer });
    });

    this.socket.write(request);
    return promise;
  }
}

/**
 * @deprecated Use {@link ModbusTcpClient} instead. `ModbusTcpStub` was a zeroed-data stub;
 * `ModbusTcpClient` implements real Modbus TCP function code 03 (Read Holding Registers).
 */
export type ModbusTcpStub = ModbusTcpClient;
