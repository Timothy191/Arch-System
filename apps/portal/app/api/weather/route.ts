import { NextResponse } from 'next/server';
import { z } from 'zod';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';

const weatherAlertSchema = z.object({
  alert_type: z.enum(['lightning', 'heavy_rain', 'high_wind']),
  distance_km: z.number().min(0),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  timestamp: z.string().datetime(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const alert = weatherAlertSchema.parse(body);

    // Only trigger Red Code for lightning within 5km
    if (alert.alert_type === 'lightning' && alert.distance_km <= 5) {
      // Trigger the background n8n webhook for Emergency Muster
      const jobId = crypto.randomUUID();

      // Fire-and-forget background execution
      // using Promise.allSettled to ensure zero-waterfall and non-blocking I/O
      await Promise.allSettled([
        triggerTrackedWorkflow(jobId, '/webhook/emergency-muster', {
          alertType: alert.alert_type,
          severity: alert.severity,
          distance: alert.distance_km,
        }),
      ]);

      return NextResponse.json(
        {
          success: true,
          message: 'Red Code Muster Initiated',
          jobId,
        },
        { status: 202 }
      );
    }

    return NextResponse.json({ success: true, message: 'Alert logged, no action required' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
}
