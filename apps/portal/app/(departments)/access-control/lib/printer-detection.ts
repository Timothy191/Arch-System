/**
 * CUPS Printer Detection Utility
 *
 * Wraps Linux CUPS commands (lpstat, lpq, lp) without invoking a shell (`execFile` / `spawn`).
 * Runs on-prem when local gatehouse USB/CUPS hardware is attached.
 *
 * @module printer-detection
 */

import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { safeCupsNameRegex, safeJobNameRegex } from '@repo/contract/schemas/access-control.schema';
import { ValidationError } from '@repo/errors';

const execFileAsync = promisify(execFile);

interface DetectedPrinter {
  cupsName: string;
  model: string;
  connectionType: 'usb' | 'network' | 'unknown';
  status: 'online' | 'offline' | 'error';
  statusMessage?: string;
  vendorId?: string;
  productId?: string;
  devicePath?: string;
  isNeoMagic300: boolean;
}

interface PrintQueueEntry {
  jobId: number;
  status: string;
  size: number;
}

const NEO_MAGIC_KEYWORDS = ['neo magic 300', 'magicard', 'neo', 'matica'];
const COMMAND_TIMEOUT_MS = 10_000;

function assertSafeCupsName(cupsName: string): string {
  const trimmed = cupsName.trim();
  if (!safeCupsNameRegex.test(trimmed)) {
    throw new ValidationError('Invalid CUPS printer name');
  }
  return trimmed;
}

function assertSafeJobName(jobName: string): string {
  const trimmed = jobName.trim();
  if (!safeJobNameRegex.test(trimmed)) {
    throw new ValidationError('Invalid CUPS print job name');
  }
  return trimmed;
}

function isNeoMagicModel(model: string): boolean {
  const lower = model.toLowerCase();
  return NEO_MAGIC_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function parseAcceptingStatus(line: string): {
  status: DetectedPrinter['status'];
  statusMessage?: string;
} {
  if (line.includes('not accepting requests')) {
    const reasonIndex = line.indexOf(' - ');
    const statusMessage = reasonIndex !== -1 ? line.slice(reasonIndex + 3).trim() : undefined;
    return { status: 'offline', statusMessage };
  }

  if (line.includes('accepting requests')) {
    return { status: 'online' };
  }

  return { status: 'error', statusMessage: line.trim() };
}

function extractPrinterName(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const spaceIndex = trimmed.indexOf(' ');
  const candidate = spaceIndex !== -1 ? trimmed.slice(0, spaceIndex) : trimmed;
  return safeCupsNameRegex.test(candidate) ? candidate : null;
}

function parseDeviceUri(
  uri: string
): Pick<DetectedPrinter, 'connectionType' | 'vendorId' | 'productId' | 'devicePath'> {
  if (uri.startsWith('usb://')) {
    const ids = uri.match(/usb:\/\/([^/?#]+)[/:]([^/?#]+)/);
    return {
      connectionType: 'usb',
      vendorId: ids?.[1] ?? undefined,
      productId: ids?.[2] ?? undefined,
    };
  }

  if (uri.startsWith('socket://') || uri.startsWith('lpd://')) {
    return { connectionType: 'network' };
  }

  return { connectionType: 'unknown' };
}

async function safeExecFile(
  file: string,
  args: readonly string[]
): Promise<{ stdout: string; stderr: string } | null> {
  try {
    const result = await execFileAsync(file, [...args], {
      timeout: COMMAND_TIMEOUT_MS,
      shell: false,
    });
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch {
    return null;
  }
}

async function getPrinterDetails(cupsName: string): Promise<Partial<DetectedPrinter>> {
  const safeName = assertSafeCupsName(cupsName);
  const result = await safeExecFile('lpstat', ['-l', '-p', safeName]);
  if (!result) return {};

  const lines = result.stdout.split('\n');
  const details: Partial<DetectedPrinter> = {};
  const modelParts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('Device:')) {
      const uri = trimmed.replace(/^Device:\s*/, '').trim();
      Object.assign(details, parseDeviceUri(uri));
      continue;
    }

    if (trimmed.startsWith('Description:') || trimmed.startsWith('Make and model:')) {
      const value = trimmed.replace(/^(Description|Make and model):\s*/, '');
      modelParts.push(value);
    }
  }

  const model = modelParts.join(' ').trim();
  if (model) {
    details.model = model;
    details.isNeoMagic300 = isNeoMagicModel(model);
  }

  return details;
}

export async function scanCupsPrinters(): Promise<DetectedPrinter[]> {
  const result = await safeExecFile('lpstat', ['-a']);
  if (!result) {
    return [];
  }

  const lines = result.stdout.split('\n').filter(Boolean);
  if (lines.length === 0) return [];

  const printers: DetectedPrinter[] = [];

  for (const line of lines) {
    const cupsName = extractPrinterName(line);
    if (!cupsName) continue;

    const { status, statusMessage } = parseAcceptingStatus(line);
    const details = await getPrinterDetails(cupsName);

    printers.push({
      cupsName,
      model: details.model ?? cupsName,
      connectionType: details.connectionType ?? 'unknown',
      status,
      statusMessage,
      vendorId: details.vendorId,
      productId: details.productId,
      devicePath: details.devicePath,
      isNeoMagic300: details.isNeoMagic300 ?? isNeoMagicModel(cupsName),
    });
  }

  return printers;
}

export async function getPrinterQueue(cupsName: string): Promise<PrintQueueEntry[]> {
  const safeName = assertSafeCupsName(cupsName);
  const result = await safeExecFile('lpq', ['-P', safeName]);
  if (!result) return [];

  const lines = result.stdout.split('\n').filter(Boolean);
  const dataStartIndex = lines.findIndex(
    (l) => l.includes('Rank') && l.includes('Owner') && l.includes('Job') && l.includes('File')
  );
  if (dataStartIndex === -1) return [];

  const dataLines = lines.slice(dataStartIndex + 1).filter((l) => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !trimmed.includes('no entries');
  });

  const entries: PrintQueueEntry[] = [];

  for (const line of dataLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const jobId = Number.parseInt(parts[2]!, 10);
    if (Number.isNaN(jobId)) continue;

    const sizeToken = parts[parts.length - 2]!;
    const size = Number.parseInt(sizeToken, 10) || 0;

    entries.push({ jobId, status: parts[0]!, size });
  }

  return entries;
}

export async function getPrinterStatus(cupsName: string): Promise<'online' | 'offline' | 'error'> {
  const safeName = assertSafeCupsName(cupsName);
  const result = await safeExecFile('lpstat', ['-p', safeName]);
  if (!result) return 'error';

  const statusLine = result.stdout.split('\n').find((l) => l.toLowerCase().includes('printer'));
  if (!statusLine) return 'error';

  const lower = statusLine.toLowerCase();

  if (lower.includes('idle') || lower.includes('printing') || lower.includes('processing')) {
    return 'online';
  }

  if (lower.includes('disabled') || lower.includes('offline')) {
    return 'offline';
  }

  return 'error';
}

export async function scanUsbDevices(): Promise<string[]> {
  const candidates = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2', '/dev/usb/lp3'];
  const found: string[] = [];

  for (const devicePath of candidates) {
    try {
      await access(devicePath);
      found.push(devicePath);
    } catch {
      // Device doesn't exist — skip
    }
  }

  return found;
}

/**
 * Submit a print job payload to CUPS via `lp` stdin without spawning a shell.
 * Rejects empty payloads instead of submitting `/dev/null`.
 */
export async function submitCupsPrintJob(
  cupsName: string,
  jobName: string,
  payload: Buffer | string,
  copies = 1
): Promise<{ cupsJobId: number | null }> {
  const safeName = assertSafeCupsName(cupsName);
  const safeJob = assertSafeJobName(jobName);
  const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;

  if (!payloadBuffer || payloadBuffer.length === 0) {
    throw new ValidationError('Print job payload cannot be empty');
  }

  const safeCopies = Math.max(1, Math.min(5, Math.trunc(copies)));

  const stdout = await new Promise<string | null>((resolve) => {
    const child = spawn('lp', ['-d', safeName, '-t', safeJob, '-n', String(safeCopies)], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const outChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve(null);
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => outChunks.push(chunk));
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve(null);
        return;
      }
      resolve(Buffer.concat(outChunks).toString('utf8').trim());
    });

    child.stdin.write(payloadBuffer);
    child.stdin.end();
  });

  if (!stdout) {
    return { cupsJobId: null };
  }

  const match = stdout.match(/request id is [\w.-]+-(\d+)/);
  const cupsJobId = match ? Number.parseInt(match[1]!, 10) : null;

  return { cupsJobId };
}

export async function detectAllPrinters(): Promise<DetectedPrinter[]> {
  const [cupsPrinters, usbDevices] = await Promise.all([scanCupsPrinters(), scanUsbDevices()]);
  const knownDevicePaths = new Set(cupsPrinters.map((p) => p.devicePath).filter(Boolean));

  for (const devPath of usbDevices) {
    if (knownDevicePaths.has(devPath)) continue;

    cupsPrinters.push({
      cupsName: `usb-${devPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
      model: `Unknown USB Printer (${devPath})`,
      connectionType: 'usb',
      status: 'online',
      devicePath: devPath,
      isNeoMagic300: false,
    });
  }

  return cupsPrinters;
}
