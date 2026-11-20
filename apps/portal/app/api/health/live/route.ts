import { type NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const startedAt = Date.now();

  return NextResponse.json(
    {
      status: 'healthy',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
}
