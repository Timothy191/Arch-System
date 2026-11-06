import { clientLogPayloadSchema } from '@repo/contract';
import { serverLogger as logger } from '@repo/logger';
import { NextResponse } from 'next/server';

const HTTP_BAD_REQUEST = 400;
const RESERVED_LOG_KEYS = new Set([
  'level',
  'msg',
  'time',
  'v',
  'pid',
  'hostname',
  '__proto__',
  'constructor',
  'prototype',
]);

function sanitizeClientData(rawData: unknown): Record<string, unknown> {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return {};
  }
  const safeEntries: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(rawData as Record<string, unknown>)) {
    if (!RESERVED_LOG_KEYS.has(key)) {
      safeEntries[key] = entryValue;
    }
  }
  return safeEntries;
}

export async function POST(req: Request) {
  try {
    const rawBody: unknown = await req.json();
    const parsed = clientLogPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false }, { status: HTTP_BAD_REQUEST });
    }

    const { level, msg, timestamp, data } = parsed.data;
    const safeData = sanitizeClientData(data);

    // Server-side logging of client-side events
    const clientLogPrefix = '[CLIENT]';

    switch (level) {
      case 'error':
        logger.error({ clientTimestamp: timestamp, ...safeData }, `${clientLogPrefix} ${msg}`);
        break;
      case 'warn':
        logger.warn({ clientTimestamp: timestamp, ...safeData }, `${clientLogPrefix} ${msg}`);
        break;
      case 'info':
        logger.info({ clientTimestamp: timestamp, ...safeData }, `${clientLogPrefix} ${msg}`);
        break;
      default:
        logger.debug({ clientTimestamp: timestamp, ...safeData }, `${clientLogPrefix} ${msg}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to parse client log payload');
    return NextResponse.json({ success: false }, { status: HTTP_BAD_REQUEST });
  }
}
