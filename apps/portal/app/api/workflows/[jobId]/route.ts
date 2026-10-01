import { serverlessRedis } from '@repo/redis/serverless-client';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const cacheKey = `workflow_job_${jobId}`;
    const statusData = await serverlessRedis.get(cacheKey);

    if (!statusData) {
      // If not in Redis, it might have finished and expired or never existed.
      return NextResponse.json(
        { status: 'unknown', progress: 0, error: 'Job not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json(statusData);
  } catch (error) {
    console.error('[API] Failed to fetch workflow status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
