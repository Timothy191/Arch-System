/**
 * @swagger
 * /api/export/fuel-logs:
 *   get:
 *     summary: Export fuel logs
 *     description: Export fuel consumption logs with date range filtering. Supports JSON and CSV formats (set Accept header to text/csv for CSV).
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
 *                       id:
 *                         type: string
 *                       log_date:
 *                         type: string
 *                         format: date
 *                       shift:
 *                         type: string
 *                       department_id:
 *                         type: string
 *                       machine_id:
 *                         type: string
 *                       machine_name:
 *                         type: string
 *                       machine_type:
 *                         type: string
 *                       diesel_litres:
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
 *               description: CSV file with fuel log data
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

const FUEL_LOG_EXPORT_COLUMNS = [
  'id',
  'log_date',
  'shift',
  'department_id',
  'machine_id',
  'machine_name',
  'machine_type',
  'diesel_litres',
] as const;

async function handleExportRequest(req: NextRequest): Promise<NextResponse> {
  const ctx = await prepareExportRequest(req);
  if (ctx.kind === 'rejected') return ctx.response;
  const { supabase } = ctx;
  const { from, to, dept, limit, offset } = ctx.query;
  const { fromDate, toDate } = resolveExportDateRange({ from, to });

  let query = supabase
    .from('daily_logs')
    .select(
      'id, log_date, shift, department_id, fuel_logs(id, diesel_litres, machine_id, machines(name, machine_type))',
      { count: 'estimated' }
    )
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .order('log_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const departmentId = await resolveDepartmentId(supabase, dept);
  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error, count } = await query;
  if (error) return exportDatabaseErrorResponse(req);

  interface FuelLogExportRow {
    id: string;
    log_date: string;
    shift: string;
    department_id: string;
    machine_id: string;
    machine_name: string;
    machine_type: string;
    diesel_litres: string;
  }

  interface FuelLogRelationItem {
    id: string;
    diesel_litres?: number | string | null;
    machine_id: string;
    machines?: { name?: string | null; machine_type?: string | null } | null;
  }

  interface DailyLogWithFuel {
    log_date: string;
    shift: string;
    department_id: string;
    fuel_logs?: FuelLogRelationItem | FuelLogRelationItem[] | null;
  }

  const rows: FuelLogExportRow[] = [];
  ((data ?? []) as unknown as DailyLogWithFuel[]).forEach((log) => {
    const fLogs = Array.isArray(log.fuel_logs)
      ? log.fuel_logs
      : log.fuel_logs
        ? [log.fuel_logs]
        : [];
    fLogs.forEach((fl) => {
      const machineName = fl.machines?.name ?? 'Unknown';
      const machineType = fl.machines?.machine_type ?? 'Unknown';
      rows.push({
        id: fl.id,
        log_date: log.log_date,
        shift: log.shift,
        department_id: log.department_id,
        machine_id: fl.machine_id,
        machine_name: machineName,
        machine_type: machineType,
        diesel_litres: Number(fl.diesel_litres ?? 0).toFixed(2),
      });
    });
  });

  if (wantsCsv(req)) {
    return createCsvExportResponse(req, {
      headers: FUEL_LOG_EXPORT_COLUMNS,
      rows: rows as unknown as Record<string, unknown>[],
      filename: `fuel-logs-${fromDate}-${toDate}.csv`,
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
