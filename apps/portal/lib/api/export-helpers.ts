import { exportQuerySchema } from '@repo/contract/schemas/export.schema';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { applyCors } from '@/lib/api/cors';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_INTERNAL_ERROR = 500;
const DEFAULT_HISTORY_DAYS = 30;
const MS_PER_DAY = 86_400_000;
/** Leading characters that spreadsheet apps interpret as formulas (CSV injection). */
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export type ExportRequestContext =
  | { kind: 'ok'; supabase: ServerSupabaseClient; query: ExportQuery }
  | { kind: 'rejected'; response: NextResponse };

/** Neutralizes CSV/formula injection and RFC-4180 quotes a single cell. */
export function sanitizeCsvCell(cellText: string): string {
  const sanitized = CSV_FORMULA_PREFIX.test(cellText) ? `'${cellText}` : cellText;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

/** Authenticates the caller and validates export query params (shared by all export routes). */
export async function prepareExportRequest(req: NextRequest): Promise<ExportRequestContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      kind: 'rejected',
      response: applyCors(
        req,
        NextResponse.json(
          { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
          { status: HTTP_UNAUTHORIZED }
        )
      ),
    };
  }

  const parsed = exportQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return {
      kind: 'rejected',
      response: applyCors(
        req,
        NextResponse.json(
          { error: 'Invalid query parameters', details: parsed.error.issues },
          { status: HTTP_BAD_REQUEST }
        )
      ),
    };
  }

  return { kind: 'ok', supabase, query: parsed.data };
}

export function resolveExportDateRange(range: { readonly from?: string; readonly to?: string }): {
  fromDate: string;
  toDate: string;
} {
  const fromDate =
    range.from ??
    new Date(Date.now() - DEFAULT_HISTORY_DAYS * MS_PER_DAY).toISOString().split('T')[0]!;
  const toDate = range.to ?? new Date().toISOString().split('T')[0]!;
  return { fromDate, toDate };
}

export function wantsCsv(req: NextRequest): boolean {
  return req.headers.get('accept')?.includes('text/csv') ?? false;
}

export function exportDatabaseErrorResponse(req: NextRequest): NextResponse {
  return applyCors(
    req,
    NextResponse.json(
      { success: false, error: { message: 'Database query failed', code: 'API_ERROR' } },
      { status: HTTP_INTERNAL_ERROR }
    )
  );
}

export function createCsvExportResponse<TRow extends Record<string, unknown>>(
  req: NextRequest,
  options: {
    readonly headers: readonly string[];
    readonly rows: readonly TRow[];
    readonly filename: string;
  }
): NextResponse {
  const csv = [
    options.headers.join(','),
    ...options.rows.map((row) =>
      options.headers.map((header) => sanitizeCsvCell(String(row[header] ?? ''))).join(',')
    ),
  ].join('\n');

  return applyCors(
    req,
    new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${options.filename}"`,
      },
    })
  );
}

/** Resolves a department slug to its id and applies the filter (no-op when absent/unknown). */
export async function resolveDepartmentId(
  supabase: ServerSupabaseClient,
  dept: string | undefined
): Promise<string | null> {
  if (!dept) return null;
  const { data: deptRow } = await supabase
    .from('departments')
    .select('id')
    .eq('name', dept)
    .single();
  return deptRow?.id ?? null;
}
