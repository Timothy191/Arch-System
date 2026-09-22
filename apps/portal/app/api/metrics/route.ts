/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Prometheus Metrics
 *     description: Exposes business telemetry and error metrics for Prometheus scraping.
 */

import { registry } from '@repo/utils/observability/metrics';
import { NextResponse } from 'next/server';

export async function GET() {
  const metrics = await registry.metrics();
  return new NextResponse(metrics, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
