import { randomUUID } from 'node:crypto';
import { submitFeedbackSchema } from '@repo/contract';
import { serverLogger as logger } from '@repo/logger';
import { NextResponse } from 'next/server';
import { recordSystemLog } from '@/lib/logging/system-logs';

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;
const TICKET_ID_SLICE_LEN = 8;

export async function POST(req: Request) {
  try {
    const rawBody: unknown = await req.json();
    const parsed = submitFeedbackSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid feedback payload',
          code: 'VALIDATION_ERROR',
        },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const { type, message, userEmail, pageUrl, rating, metadata } = parsed.data;
    const ticketId = `FB-${randomUUID().slice(0, TICKET_ID_SLICE_LEN).toUpperCase()}`;

    logger.info({ userEmail, metadata }, `[FEEDBACK] Type: ${type} - ${message}`);

    await recordSystemLog({
      level: type === 'bug' ? 'warn' : 'info',
      source: 'client',
      category: `feedback:${type}`,
      message,
      url: pageUrl,
      method: 'POST',
      context: {
        ticketId,
        userEmail: userEmail ?? null,
        rating: rating ?? null,
        ...(metadata ?? {}),
      },
    });

    return NextResponse.json({ success: true, ticketId });
  } catch (error) {
    logger.error({ error }, 'Failed to process feedback submission');
    return NextResponse.json({ success: false }, { status: HTTP_INTERNAL_ERROR });
  }
}
