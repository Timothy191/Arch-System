// packages/redis/src/audit.ts
import { getRedisClient } from './client';
import { sendSafe } from './raw';
import { collectRedisHealthDiagnostics } from './stats';

export interface BigKeyEntry {
  key: string;
  type: string;
  size: number;
}

export interface HotKeyEntry {
  key: string;
  freq: number;
}

export async function auditBigKeys(options?: {
  scanCount?: number;
  sizeThresholdBytes?: number;
}): Promise<BigKeyEntry[]> {
  const scanCount = options?.scanCount ?? 100;
  const threshold = options?.sizeThresholdBytes ?? 1024;
  const client = await getRedisClient();
  if (!client) return [];
  const results: BigKeyEntry[] = [];
  let cursor = '0';
  do {
    const reply = await sendSafe(client, ['SCAN', cursor, 'COUNT', scanCount]);
    const arr = Array.isArray(reply) ? reply : [];
    cursor = String(arr[0] ?? '0');
    const keys = Array.isArray(arr[1]) ? (arr[1] as string[]) : [];
    for (const key of keys) {
      const type = String((await sendSafe(client, ['TYPE', key])) ?? 'none');
      let size = 0;
      if (type === 'string') {
        size = Number((await sendSafe(client, ['STRLEN', key])) ?? 0);
      } else if (type === 'hash') {
        size = Number((await sendSafe(client, ['HLEN', key])) ?? 0);
      } else if (type === 'list') {
        size = Number((await sendSafe(client, ['LLEN', key])) ?? 0);
      } else if (type === 'set') {
        size = Number((await sendSafe(client, ['SCARD', key])) ?? 0);
      } else if (type === 'zset') {
        size = Number((await sendSafe(client, ['ZCARD', key])) ?? 0);
      } else {
        const mem = await sendSafe(client, ['MEMORY', 'USAGE', key]);
        size = Number(mem ?? 0);
      }
      if (size >= threshold) results.push({ key, type, size });
    }
  } while (cursor !== '0');
  return results;
}

export async function auditHotKeys(options?: { topN?: number }): Promise<HotKeyEntry[]> {
  const topN = options?.topN ?? 10;
  try {
    const diag = await collectRedisHealthDiagnostics();
    if (!diag) return [];
    return [{ key: 'slowlog', freq: diag.slowlogCount }].slice(0, topN);
  } catch {
    return [];
  }
}
