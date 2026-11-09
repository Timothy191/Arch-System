/**
 * @swagger
 * /api/export/production:
 *   get:
 *     summary: Export production logs
 *     description: Export production data (coal and waste tonnage) with date range filtering. Supports JSON and CSV formats (set Accept header to text/csv for CSV).
 *     tags:
 *       - Export
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: "Start date (YYYY-MM-DD, default: 30 days ago)"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: "End date (YYYY-MM-DD, default: today)"
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
 *                       log_date:
 *                         type: string
 *                         format: date
 *                       shift:
 *                         type: string
 *                       department_id:
 *                         type: string
 *                       coal_tonnes:
 *                         type: string
 *                       waste_tonnes:
 *                         type: string
 *                       total_tonnes:
 *                         type: string
 *                 from:
 *                   type: string
 *                 to:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV file with production data
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
  resolveExportDateRange,
  wantsCsv,
} from '@/lib/api/export-helpers';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

export const maxDuration = 60;

async function handleExportRequest(req: NextRequest): Promise<NextResponse> {
  const ctx = await prepareExportRequest(req);
  if (ctx.kind === 'rejected') return ctx.response;
  const { supabase } = ctx;
  const { from, to, dept, limit, offset } = ctx.query;
  const { fromDate, toDate } = resolveExportDateRange({ from, to });

  let query = supabase
    .from('daily_logs')
    .select('id, log_date, shift, department_id, production_logs(coal_tonnes, waste_tonnes)', {
      count: 'estimated',
    })
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .order('log_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const departmentId = await resolveDepartmentId(supabase, dept);
  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error, count } = await query;
  if (error) return exportDatabaseErrorResponse(req);

  type ProdLog = { coal_tonnes: number | null; waste_tonnes: number | null };
  type DailyLogRow = {
    id: string;
    log_date: string;
    shift: string;
    department_id: string;
    production_logs: ProdLog[] | ProdLog | null;
  };

  const rows = (data as DailyLogRow[]).map((log) => {
    const prods = Array.isArray(log.production_logs)
      ? log.production_logs
      : log.production_logs
        ? [log.production_logs]
        : [];
    const coal = prods.reduce((s, p) => s + (p.coal_tonnes ?? 0), 0);
    const waste = prods.reduce((s, p) => s + (p.waste_tonnes ?? 0), 0);
    return {
      log_date: log.log_date,
      shift: log.shift,
      department_id: log.department_id,
      coal_tonnes: coal.toFixed(2),
      waste_tonnes: waste.toFixed(2),
      total_tonnes: (coal + waste).toFixed(2),
    };
  });

  if (wantsCsv(req)) {
    return createCsvExportResponse(req, {
      headers: Object.keys(rows[0] ?? {}),
      rows,
      filename: `production-${fromDate}-${toDate}.csv`,
    });
  }

  const response = NextResponse.json({
    data: rows,
    from: fromDate,
    to: toDate,
    count: count ?? rows.length,
    limit,
    offset,
  });
  return applyCors(req, response);
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, () => handleExportRequest(req));
}
