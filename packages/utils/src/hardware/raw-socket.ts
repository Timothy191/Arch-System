export interface RawSocketOptions {
  host: string;
  port: number;
  timeout?: number;
}

/**
 * Production-ready stub for raw TCP socket communication.
 * Used for interfacing with Port 9100 industrial Zebra/ZPL badge printers.
 */
export class RawSocketBridge {
  private host: string;
  private port: number;
  private timeout: number;

  constructor(options: RawSocketOptions) {
    this.host = options.host;
    this.port = options.port;
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Sends raw data (e.g., ZPL commands) to the socket and gracefully closes the connection.
   */
  public async send(data: string | Buffer): Promise<void> {
    if (typeof window !== 'undefined') {
      throw new Error('RawSocketBridge is only available on the server runtime');
    }
    const net = await import(/* webpackIgnore: true */ 'node:net');
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeout);

      socket.connect(this.port, this.host, () => {
        socket.write(data, (err?: Error | null) => {
          if (err) {
            socket.destroy();
            reject(err);
          } else {
            socket.end();
          }
        });
      });

      socket.on('close', () => {
        resolve();
      });

      socket.on('error', (err: Error) => {
        socket.destroy();
        reject(err);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Socket connection timeout'));
      });
    });
  }
}
