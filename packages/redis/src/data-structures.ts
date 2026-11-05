// packages/redis/src/data-structures.ts
import { getRedisClient } from './client';
import { sendSafe } from './raw';

export async function streamAdd(
  key: string,
  fields: Record<string, string | number>,
  options?: { maxlen?: number; approximate?: boolean }
): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) return null;
  const args: (string | number)[] = ['XADD', key];
  if (options?.maxlen) {
    args.push(options.approximate ? 'MAXLEN' : 'MAXLEN', '~', options.maxlen);
  }
  args.push('*');
  for (const [k, v] of Object.entries(fields)) {
    args.push(k, v);
  }
  const r = await sendSafe(client, args);
  return r == null ? null : String(r);
}

export async function streamReadGroup(
  group: string,
  consumer: string,
  streams: string[],
  options?: { count?: number; blockMs?: number }
): Promise<unknown> {
  const client = await getRedisClient();
  if (!client) return null;
  const args: (string | number)[] = ['XREADGROUP', 'GROUP', group, consumer];
  if (options?.count) args.push('COUNT', options.count);
  if (options?.blockMs != null) args.push('BLOCK', options.blockMs);
  args.push('STREAMS', ...streams, ...streams.map(() => '>'));
  return sendSafe(client, args);
}

export async function streamAck(key: string, group: string, ids: string[]): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  const r = await sendSafe(client, ['XACK', key, group, ...ids]);
  return Number(r ?? 0);
}

export async function pfAdd(key: string, values: (string | number)[]): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  const r = await sendSafe(client, ['PFADD', key, ...values]);
  return Number(r ?? 0);
}

export async function pfCount(keys: string[]): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  const r = await sendSafe(client, ['PFCOUNT', ...keys]);
  return Number(r ?? 0);
}

export async function pfMerge(dest: string, sources: string[]): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) return null;
  const r = await sendSafe(client, ['PFMERGE', dest, ...sources]);
  return r == null ? null : String(r);
}

export async function setBitFlag(key: string, offset: number, value: 0 | 1): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  const r = await sendSafe(client, ['SETBIT', key, offset, value]);
  return Number(r ?? 0);
}

export async function getBitFlag(key: string, offset: number): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  const r = await sendSafe(client, ['GETBIT', key, offset]);
  return Number(r ?? 0);
}

export async function bitCountRange(key: string, start: number, end: number): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  const r = await sendSafe(client, ['BITCOUNT', key, start, end]);
  return Number(r ?? 0);
}

export interface ZAddMember {
  member: string | number;
  score: number;
}

export async function zadd(
  key: string,
  members: ZAddMember[],
  options?: { nx?: boolean; xx?: boolean; ch?: boolean; incr?: boolean }
): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  const args: (string | number)[] = ['ZADD', key];
  if (options?.nx) args.push('NX');
  if (options?.xx) args.push('XX');
  if (options?.ch) args.push('CH');
  if (options?.incr) args.push('INCR');
  for (const m of members) {
    args.push(m.score, m.member);
  }
  const r = await sendSafe(client, args);
  return Number(r ?? 0);
}

export async function zrange(
  key: string,
  start: number,
  stop: number,
  options?: { withScores?: boolean; rev?: boolean }
): Promise<unknown> {
  const client = await getRedisClient();
  if (!client) return null;
  const cmd = options?.rev ? 'ZREVRANGE' : 'ZRANGE';
  const args: (string | number)[] = [cmd, key, start, stop];
  if (options?.withScores) args.push('WITHSCORES');
  return sendSafe(client, args);
}

export async function zrank(
  key: string,
  member: string | number,
  options?: { rev?: boolean }
): Promise<number | null> {
  const client = await getRedisClient();
  if (!client) return null;
  const cmd = options?.rev ? 'ZREVRANK' : 'ZRANK';
  const r = await sendSafe(client, [cmd, key, member]);
  return r == null ? null : Number(r);
}
