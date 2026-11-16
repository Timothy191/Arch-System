import { NextRequest, NextResponse } from 'next/server';
import { authorizeRedisProxyRequest as isAuthorized } from '@/lib/api/telemetry-auth';
import { redisEngine } from '@/lib/redis-engine';

const HTTP_BAD_REQUEST_STATUS = 400;
const HTTP_UNAUTHORIZED_STATUS = 401;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ command: string[] }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Unauthorized: Invalid Redis token', code: 'API_ERROR' },
      },
      { status: HTTP_UNAUTHORIZED_STATUS }
    );
  }

  try {
    const { command: segments } = await params;
    if (!segments || segments.length === 0) {
      return NextResponse.json({ result: 'PONG' });
    }

    const command = segments[0] as string;
    const args = segments.slice(1).map(decodeURIComponent);
    const result = redisEngine.executeCommand(command, args);

    return NextResponse.json({ result });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error && err.message ? err.message : 'Execution error',
          code: 'API_ERROR',
        },
      },
      { status: HTTP_BAD_REQUEST_STATUS }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ command: string[] }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Unauthorized: Invalid Redis token', code: 'API_ERROR' },
      },
      { status: HTTP_UNAUTHORIZED_STATUS }
    );
  }

  try {
    const { command: segments } = await params;
    const body = await req.json().catch(() => ({}));

    if (segments && segments[0] === 'pipeline') {
      const commands: Array<{ command: string; args: string[] }> = body.commands || [];
      const results = commands.map((c) => redisEngine.executeCommand(c.command, c.args || []));
      return NextResponse.json({ results });
    }

    const command = segments?.[0] || body.command || 'PING';
    const urlArgs =
      segments && segments.length > 1 ? segments.slice(1).map(decodeURIComponent) : null;
    const args = urlArgs ?? (Array.isArray(body.args) ? body.args : []);
    const result = redisEngine.executeCommand(command, args);

    return NextResponse.json({ result });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error && err.message ? err.message : 'Execution error',
          code: 'API_ERROR',
        },
      },
      { status: HTTP_BAD_REQUEST_STATUS }
    );
  }
}
