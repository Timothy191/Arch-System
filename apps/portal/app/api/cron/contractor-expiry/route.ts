import { createServerSupabaseClient } from '@repo/supabase/server';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

export async function GET(req: Request) {
  // Validate Vercel Cron Secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // We would typically query the Supabase DB here for badges expiring in exactly 48h
    // For the background job, we can just trigger the n8n orchestrator which handles the query and email blast natively.
    const jobId = randomUUID();
    await Promise.allSettled([
      triggerTrackedWorkflow(jobId, '/webhook/contractor-expiry-check', {
        target_hours: 48,
        run_timestamp: new Date().toISOString(),
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Contractor expiry sweep initiated',
      jobId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to initiate sweep' },
      { status: 500 }
    );
  }
}
