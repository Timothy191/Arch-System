/**
 * @swagger
 * /api/offline-mutations:
 *   post:
 *     summary: Replay an authenticated employee's offline SMR mutations
 *     tags:
 *       - Offline Operations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientHlc, mutations]
 *             properties:
 *               clientHlc:
 *                 type: object
 *                 required: [wall, counter, node]
 *                 properties:
 *                   wall: { type: integer, minimum: 0 }
 *                   counter: { type: integer, minimum: 0, maximum: 2147483647 }
 *                   node: { type: string, minLength: 1, maxLength: 128 }
 *               mutations:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 500
 *                 items:
 *                   type: object
 *                   required: [id, hlc, entity, entityId, op, payload]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     entity: { type: string, enum: [smr] }
 *                     entityId: { type: string, minLength: 1, maxLength: 128 }
 *                     op: { type: string, enum: [smr.update] }
 *                     payload:
 *                       type: object
 *                       required: [meterId, reading, readingAt, deviceId]
 *                       properties:
 *                         meterId: { type: string, minLength: 1, maxLength: 128 }
 *                         reading: { type: number, minimum: 0 }
 *                         readingAt: { type: string, format: date-time }
 *                         deviceId: { type: string, minLength: 1, maxLength: 128 }
 *     responses:
 *       200:
 *         description: Mutations accepted and persisted atomically
 *       400:
 *         description: Malformed or invalid mutation batch
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Employee or department is not authorized
 *       413:
 *         description: Request body exceeds the size limit
 *       500:
 *         description: Mutation persistence failed
 */

import { offlineMutationBatchSchema } from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/errors/error-logger';

const MAX_BODY_BYTES = 1024 * 1024;

export async function POST(req: Request): Promise<NextResponse> {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);

    if (!principal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!principal.employee?.department_id) {
      return NextResponse.json({ error: 'Employee department not found' }, { status: 403 });
    }
    if (principal.employee.role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const parsed = offlineMutationBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid offline mutation batch' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('apply_offline_mutations', {
      p_tenant: principal.employee.department_id,
      p_mutations: parsed.data.mutations,
    });

    if (error?.code === '42501') {
      return NextResponse.json({ error: 'Department access denied' }, { status: 403 });
    }
    if (error?.code === '22023' || error?.code === '22P02') {
      return NextResponse.json({ error: 'Invalid offline mutation batch' }, { status: 400 });
    }
    if (error) {
      await logError(error, { context: 'offline_mutations_rpc' });
      return NextResponse.json({ error: 'Failed to persist offline mutations' }, { status: 500 });
    }

    revalidateTag('offline-mutations', 'max');
    return NextResponse.json(data);
  } catch (error) {
    await logError(error, { context: 'offline_mutations_route' });
    return NextResponse.json({ error: 'Failed to process offline mutations' }, { status: 500 });
  }
}
