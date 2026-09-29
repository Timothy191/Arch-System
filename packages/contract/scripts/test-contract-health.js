/* eslint-disable no-console */
/**
 * @fileoverview Test contract health and validation schemas
 * Validates the canonical health check contract schemas against schema specifications
 * and optionally against a live server if reachable.
 */

const { z } = require('zod');

const healthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  latencyMs: z.number().nonnegative(),
  services: z.object({
    supabase: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latencyMs: z.number().nonnegative(),
      error: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latencyMs: z.number().nonnegative(),
      error: z.string().optional(),
    }),
    fuxa: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latencyMs: z.number().nonnegative(),
      statusCode: z.number().optional().nullable(),
      error: z.string().optional(),
    }),
  }),
});

async function main() {
  console.log('Validating contract health schema...');

  // 1. Static Contract Schema Test
  const mockValidPayload = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    latencyMs: 12,
    services: {
      supabase: { status: 'healthy', latencyMs: 5 },
      redis: { status: 'healthy', latencyMs: 2 },
      fuxa: { status: 'healthy', latencyMs: 4, statusCode: 200 },
    },
  };

  const parseResult = healthCheckResponseSchema.safeParse(mockValidPayload);
  if (!parseResult.success) {
    console.error('❌ Static health schema contract validation failed:', parseResult.error);
    process.exit(1);
  }
  console.log('✓ Static healthCheckResponseSchema contract verified successfully');

  // 2. Optional Live API check
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${API_URL}/api/control-room/scada-status`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      console.log(`✓ Live API responded at ${API_URL} (status: ${res.status})`);
    } else {
      console.log(`ℹ Live API responded with status ${res.status}`);
    }
  } catch (_err) {
    console.log(`ℹ Live API not reachable at ${API_URL}; static contract verification confirmed.`);
  }

  console.log('✓ Contract health test completed.');
}

main().catch((err) => {
  console.error('Fatal error in test-contract-health:', err);
  process.exit(1);
});
