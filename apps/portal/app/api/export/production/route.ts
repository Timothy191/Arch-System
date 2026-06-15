import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { validateBody as _validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { exportQuerySchema } from "@repo/contract";

function sanitizeCsvCell(value: string): string {
  const dangerous = /^[=+\-@\t\r]/;
  const sanitized = dangerous.test(value) ? "'" + value : value;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

async function handleExportRequest(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return applyCors(
      req,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { searchParams } = req.nextUrl;
  const params = Object.fromEntries(searchParams.entries());
  const parsed = exportQuerySchema.safeParse(params);
  if (!parsed.success) {
    return applyCors(
      req,
      NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 },
      ),
    );
  }
  const { from, to, dept, limit, offset } = parsed.data;

  const fromDate =
    from ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]!;
  const toDate = to ?? new Date().toISOString().split("T")[0]!;

  const format = req.headers.get("accept")?.includes("text/csv")
    ? "csv"
    : "json";

  let query = supabase
    .from("daily_logs")
    .select(
      "id, log_date, shift, department_id, production_logs(coal_tonnes, waste_tonnes)",
      { count: "estimated" },
    )
    .gte("log_date", fromDate)
    .lte("log_date", toDate)
    .order("log_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (dept) {
    const { data: deptRow } = await supabase
      .from("departments")
      .select("id")
      .eq("name", dept)
      .single();
    if (deptRow) query = query.eq("department_id", deptRow.id);
  }

  const { data, error, count } = await query;
  if (error) {
    return applyCors(
      req,
      NextResponse.json({ error: "Database query failed" }, { status: 500 }),
    );
  }

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

  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? {});
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => sanitizeCsvCell(String(r[h as keyof typeof r])))
          .join(","),
      ),
    ].join("\n");
    const response = new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="production-${fromDate}-${toDate}.csv"`,
      },
    });
    return applyCors(req, response);
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
