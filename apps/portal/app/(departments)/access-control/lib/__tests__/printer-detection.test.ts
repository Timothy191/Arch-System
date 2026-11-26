/**
 * Tests for printer-detection.ts — CUPS/USB printer utility.
 *
 * Mocks node:child_process (`execFile`, `spawn`) and node:fs/promises (`access`).
 */

import { execFile, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { access } from 'node:fs/promises';
import { Writable } from 'node:stream';

import {
  detectAllPrinters,
  getPrinterQueue,
  getPrinterStatus,
  scanCupsPrinters,
  submitCupsPrintJob,
} from '../printer-detection';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
  spawn: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  access: jest.fn(),
}));

const mockExecFile = execFile as unknown as jest.Mock;
const mockSpawn = spawn as unknown as jest.Mock;
const mockAccess = access as unknown as jest.Mock;

function mockExecFileCommand(commands: Record<string, string>): void {
  mockExecFile.mockImplementation(
    (
      file: string,
      args: readonly string[],
      _opts: unknown,
      cb: (_err: Error | null, _result: { stdout: string; stderr: string } | null) => void
    ) => {
      const cmdLine = `${file} ${args.join(' ')}`;
      for (const [match, stdout] of Object.entries(commands)) {
        if (cmdLine.includes(match)) {
          cb(null, { stdout, stderr: '' });
          return;
        }
      }
      cb(new Error(`Command not mocked: ${cmdLine}`), null);
    }
  );
}

function mockAccessForPaths(resolvePaths: string[]): void {
  mockAccess.mockImplementation((path: string) => {
    if (resolvePaths.includes(path)) {
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error('ENOENT'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scanCupsPrinters()', () => {
  it('returns empty array when lpstat is not found', async () => {
    mockExecFile.mockImplementation(
      (
        _file: unknown,
        _args: unknown,
        _opts: unknown,
        cb: (_err: Error | null, _result: undefined) => void
      ) => {
        cb(new Error('Command not found: lpstat'), undefined);
      }
    );

    const result = await scanCupsPrinters();

    expect(result).toEqual([]);
  });

  it('returns empty array when no printers are configured (empty stdout)', async () => {
    mockExecFileCommand({ 'lpstat -a': '' });

    const result = await scanCupsPrinters();

    expect(result).toEqual([]);
  });

  it('parses a single online printer correctly', async () => {
    mockExecFileCommand({
      'lpstat -a': 'printer1 accepting requests since Mon Jan 1 00:00:00 2024',
      'lpstat -l -p': '',
    });

    const result = await scanCupsPrinters();

    expect(result).toHaveLength(1);
    expect(result[0]!.cupsName).toBe('printer1');
    expect(result[0]!.status).toBe('online');
  });

  it('parses multiple printers with mixed statuses', async () => {
    mockExecFileCommand({
      'lpstat -a': [
        'printer1 accepting requests since Mon Jan 1 00:00:00 2024',
        'printer2 not accepting requests since Tue Jan 2 00:00:00 2024 - Paper jam',
      ].join('\n'),
      'lpstat -l -p': '',
    });

    const result = await scanCupsPrinters();

    expect(result).toHaveLength(2);
    expect(result.find((p) => p.cupsName === 'printer1')?.status).toBe('online');
    const p2 = result.find((p) => p.cupsName === 'printer2');
    expect(p2?.status).toBe('offline');
    expect(p2?.statusMessage).toBe('Paper jam');
  });

  it('handles a printer with USB device URI', async () => {
    mockExecFileCommand({
      'lpstat -a': 'printer1 accepting requests since Mon Jan 1 00:00:00 2024',
      'lpstat -l -p': [
        'Description: Card Printer 3000',
        'Make and model: Magicard Neo',
        'Device: usb://Vendor/Product?serial=123',
      ].join('\n'),
    });

    const result = await scanCupsPrinters();

    expect(result).toHaveLength(1);
    expect(result[0]!.connectionType).toBe('usb');
    expect(result[0]!.vendorId).toBe('Vendor');
    expect(result[0]!.productId).toBe('Product');
  });
});

describe('getPrinterStatus()', () => {
  it("returns 'online' when printer is idle", async () => {
    mockExecFileCommand({
      'lpstat -p': 'printer printer1 is idle.  enabled since Mon Jan 1 00:00:00 2024',
    });

    expect(await getPrinterStatus('printer1')).toBe('online');
  });

  it("returns 'offline' when printer is disabled", async () => {
    mockExecFileCommand({
      'lpstat -p': 'printer printer1 is disabled.  enabled since Mon Jan 1 00:00:00 2024',
    });

    expect(await getPrinterStatus('printer1')).toBe('offline');
  });

  it('rejects shell-injection characters in cupsName', async () => {
    await expect(getPrinterStatus('printer1; rm -rf /')).rejects.toThrow(
      'Invalid CUPS printer name'
    );
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

describe('getPrinterQueue()', () => {
  it('returns empty array when lpq fails', async () => {
    mockExecFile.mockImplementation(
      (
        _file: unknown,
        _args: unknown,
        _opts: unknown,
        cb: (_err: Error | null, _result: undefined) => void
      ) => {
        cb(new Error('Command not found'), undefined);
      }
    );

    expect(await getPrinterQueue('printer1')).toEqual([]);
  });

  it('parses queue entries correctly', async () => {
    mockExecFileCommand({
      'lpq -P': [
        'printer1 is ready',
        'Rank    Owner   Job     File(s)                         Total Size',
        'active  user    42      card_abc123.png                 1024 bytes',
      ].join('\n'),
    });

    const result = await getPrinterQueue('printer1');

    expect(result).toHaveLength(1);
    expect(result[0]!.jobId).toBe(42);
    expect(result[0]!.status).toBe('active');
    expect(result[0]!.size).toBe(1024);
  });

  it('rejects unsafe cupsName', async () => {
    await expect(getPrinterQueue('bad$(whoami)')).rejects.toThrow('Invalid CUPS printer name');
  });
});

describe('submitCupsPrintJob()', () => {
  it('rejects unsafe cupsName or empty payload', async () => {
    await expect(submitCupsPrintJob('bad`id`', 'Card Job', 'ZPL')).rejects.toThrow(
      'Invalid CUPS printer name'
    );
    await expect(submitCupsPrintJob('Magicard_Neo300', 'Card Job', '')).rejects.toThrow(
      'Print job payload cannot be empty'
    );
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('pipes print payload via stdin without invoking a shell', async () => {
    const written: Buffer[] = [];
    mockSpawn.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdin: Writable;
        stdout: EventEmitter;
        kill: jest.Mock;
      };
      child.stdout = new EventEmitter();
      child.kill = jest.fn();
      child.stdin = new Writable({
        write(chunk, _enc, cb) {
          written.push(Buffer.from(chunk));
          cb();
        },
      });
      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from('request id is Magicard_Neo300-77 (1 file(s))'));
        child.emit('close', 0);
      });
      return child;
    });

    const result = await submitCupsPrintJob('Magicard_Neo300', 'Badge Print', 'CARD-BYTES', 2);

    expect(result.cupsJobId).toBe(77);
    expect(mockSpawn).toHaveBeenCalledWith(
      'lp',
      ['-d', 'Magicard_Neo300', '-t', 'Badge Print', '-n', '2'],
      expect.objectContaining({ shell: false })
    );
    expect(Buffer.concat(written).toString('utf8')).toBe('CARD-BYTES');
  });
});

describe('scanUsbDevices() & detectAllPrinters()', () => {
  it('merges CUPS printers with USB-only devices', async () => {
    mockExecFileCommand({
      'lpstat -a': 'network-printer1 accepting requests since Mon Jan 1 00:00:00 2024',
      'lpstat -l -p': '',
    });
    mockAccessForPaths(['/dev/usb/lp0']);

    const result = await detectAllPrinters();

    expect(result).toHaveLength(2);
    expect(result.find((p) => p.cupsName === 'network-printer1')?.connectionType).toBe('unknown');
    expect(result.find((p) => p.cupsName === 'usb-_dev_usb_lp0')?.devicePath).toBe('/dev/usb/lp0');
  });
});
