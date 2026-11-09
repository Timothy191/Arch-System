/**
 * @swagger
 * /api/export/machines:
 *   get:
 *     summary: Export machines
 *     description: Export machine registry data with optional department filtering. Supports JSON and CSV formats (set Accept header to text/csv for CSV).
 *     tags:
 *       - Export
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dept
 *         schema:
 *           type: string
 *         description: Department name filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of records
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Export data (JSON or CSV)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       machine_type:
 *                         type: string
 *                       serial_number:
 *                         type: string
 *                       bin_factor:
 *                         type: number
 *                       active:
 *                         type: boolean
 *                       department_id:
 *                         type: string
 *                       site_id:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 count:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV file with machine data
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { applyCors } from '@/lib/api/cors';
import {
  createCsvExportResponse,
  exportDatabaseErrorResponse,
  prepareExportRequest,
  resolveDepartmentId,
  wantsCsv,
} from '@/lib/api/export-helpers';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

const MACHINE_EXPORT_COLUMNS = [
  'id',
  'name',
  'machine_type',
  'serial_number',
  'bin_factor',
  'active',
  'department_id',
  'site_id',
  'created_at',
] as const;

async function handleExportRequest(req: NextRequest): Promise<NextResponse> {
  const ctx = await prepareExportRequest(req);
  if (ctx.kind === 'rejected') return ctx.response;
  const { supabase } = ctx;
  const { dept, limit, offset } = ctx.query;

  let query = supabase
    .from('machines')
    .select(
      'id, name, machine_type, serial_number, bin_factor, active, department_id, site_id, created_at',
      { count: 'estimated' }
    )
    .order('name')
    .range(offset, offset + limit - 1);

  const departmentId = await resolveDepartmentId(supabase, dept);
  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error, count } = await query;
  if (error) return exportDatabaseErrorResponse(req);

  if (wantsCsv(req)) {
    return createCsvExportResponse(req, {
      headers: MACHINE_EXPORT_COLUMNS,
      rows: (data ?? []) as unknown as Record<string, unknown>[],
      filename: 'machines.csv',
    });
  }

  const response = NextResponse.json({
    data,
    count: count ?? data?.length ?? 0,
    limit,
    offset,
  });
  return applyCors(req, response);
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, () => handleExportRequest(req));
}
