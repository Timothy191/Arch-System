import { NextResponse } from 'next/server';

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 MB default

async function exceedsStreamByteLimit(request: Request, maxSize: number): Promise<boolean> {
  if (!request.body) {
    return false;
  }

  let cloned: Request;
  try {
    cloned = request.clone();
  } catch {
    return false;
  }

  const reader = cloned.body?.getReader();
  if (!reader) {
    return false;
  }

  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxSize) {
          await reader.cancel().catch(() => undefined);
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function withBodyLimit(
  request: Request,
  handler: () => Promise<NextResponse>,
  options: { maxSize?: number } = {}
): Promise<NextResponse> {
  const maxSize = options.maxSize ?? DEFAULT_MAX_BODY_BYTES;
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxSize) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
  }

  if (await exceedsStreamByteLimit(request, maxSize)) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  return handler();
}
