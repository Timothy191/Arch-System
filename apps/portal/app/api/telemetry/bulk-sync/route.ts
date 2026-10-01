import { telemetryPushSchema } from '@repo/contract';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

const bulkTelemetrySchema = z.array(telemetryPushSchema).max(500); // Max 500 records per burst

export async function POST(req: Request) {
  return withBodyLimit(
    req,
    async () => {
      try {
        const body = await req.json();
        const data = bulkTelemetrySchema.parse(body);
        const jobId = randomUUID();

        // Pass bulk data to background processor to prevent holding the HTTP connection open
        await Promise.allSettled([
          triggerTrackedWorkflow(jobId, '/webhook/telemetry-bulk-ingest', {
            records: data.length,
            payload: data,
          }),
        ]);

        return applyCors(
          req,
          NextResponse.json(
            {
              success: true,
              message: `Bulk synced ${data.length} telemetry records`,
              jobId,
            },
            { status: 202 }
          )
        );
      } catch (error) {
        return applyCors(
          req,
          NextResponse.json({ success: false, error: 'Invalid bulk payload' }, { status: 400 })
        );
      }
    },
    { maxSize: 52428800 } // Generous 50MB limit for bulk sensor dumps
  );
}
