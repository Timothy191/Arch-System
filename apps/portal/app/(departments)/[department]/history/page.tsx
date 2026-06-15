import { getDepartmentContext } from "~/lib/dept-context";
import { GlassCard } from "@repo/ui/GlassCard";
import { Input } from "@repo/ui/Input";
import Link from "next/link";

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { department: deptSlug } = await params;
  const { from: fromParam, to: toParam } = await searchParams;
  const { dept, deptId, supabase } = await getDepartmentContext({
    department: deptSlug,
  });

  const to = toParam || new Date().toISOString().split("T")[0];
  const from =
    fromParam ||
    new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const isControlRoom = dept.type === "control_room";

  const dateFilter = (
    <GlassCard>
      <form method="GET" className="flex items-end gap-4">
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-1">
            From
          </label>
          <Input
            type="date"
            name="from"
            defaultValue={from}
            className="px-4 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-1">
            To
          </label>
          <Input
            type="date"
            name="to"
            defaultValue={to}
            className="px-4 py-2"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-heading)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          Filter
        </button>
      </form>
    </GlassCard>
  );

  // ─── Control Room branch ───────────────────────────────────────────────────
  if (isControlRoom) {
    const [
      { data: shiftStatuses },
      { data: operations },
      { data: loads },
      { data: delays },
    ] = await Promise.all([
      supabase
        .from("shift_status")
        .select(
          "shift_date, shift_type, status, closed_at, closer:employees!closed_by(full_name), approver:employees!approved_by(full_name)",
        )
        .eq("department_id", deptId)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .order("shift_date", { ascending: false }),
      supabase
        .from("machine_operations")
        .select("shift_date, shift_type, hours_worked")
        .eq("department_id", deptId)
        .gte("shift_date", from)
        .lte("shift_date", to),
      supabase
        .from("hourly_loads")
        .select("load_date, shift_type, total_loads")
        .eq("department_id", deptId)
        .gte("load_date", from)
        .lte("load_date", to),
      supabase
        .from("operational_delays")
        .select("delay_date, shift_type, delay_minutes")
        .eq("department_id", deptId)
        .gte("delay_date", from)
        .lte("delay_date", to),
    ]);

    type ShiftKey = string;
    const keyOf = (date: string, shift: string): ShiftKey => `${date}|${shift}`;

    const hoursMap = new Map<ShiftKey, number>();
    operations?.forEach((o) => {
      const k = keyOf(o.shift_date, o.shift_type);
      hoursMap.set(k, (hoursMap.get(k) || 0) + (o.hours_worked || 0));
    });

    const loadsMap = new Map<ShiftKey, number>();
    loads?.forEach((l) => {
      const k = keyOf(l.load_date, l.shift_type);
      loadsMap.set(k, (loadsMap.get(k) || 0) + (l.total_loads || 0));
    });

    const delayMap = new Map<ShiftKey, number>();
    delays?.forEach((d) => {
      const k = keyOf(d.delay_date, d.shift_type);
      delayMap.set(k, (delayMap.get(k) || 0) + (d.delay_minutes || 0));
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">
            Shift History
          </h2>
          <Link
            href={`/${deptSlug}/reports?from=${from}&to=${to}`}
            className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-cyan)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Export CSV
          </Link>
        </div>

        {dateFilter}

        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  {[
                    { label: "Date", align: "" },
                    { label: "Shift", align: "" },
                    { label: "Status", align: "" },
                    { label: "Hours", align: "text-right" },
                    { label: "Loads", align: "text-right" },
                    { label: "Delay (min)", align: "text-right" },
                    { label: "Closed By", align: "" },
                  ].map(({ label, align }) => (
                    <th
                      key={label}
                      scope="col"
                      className={`px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider ${align}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {shiftStatuses?.map((ss) => {
                  const k = keyOf(ss.shift_date, ss.shift_type);
                  const closer = Array.isArray(ss.closer)
                    ? ss.closer[0]
                    : ss.closer;
                  return (
                    <tr
                      key={k}
                      className="hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <td className="px-6 py-4 text-[var(--text-heading)] text-sm">
                        {ss.shift_date}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            ss.shift_type === "day"
                              ? "bg-accent-blue/10 text-accent-blue"
                              : "bg-indigo-500/10 text-indigo-400"
                          }`}
                        >
                          {ss.shift_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            ss.status === "closed"
                              ? "bg-emerald-50/70 border-emerald-200/50 text-emerald-700"
                              : "bg-amber-50/70 border-amber-200/50 text-amber-700"
                          }`}
                        >
                          {ss.status === "closed" && (
                            <span className="badge-pulse-dot bg-emerald-500" />
                          )}
                          {ss.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] text-sm text-right">
                        {(hoursMap.get(k) || 0).toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-[var(--accent-cyan)] text-sm text-right">
                        {(loadsMap.get(k) || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-accent-blue text-sm text-right">
                        {delayMap.get(k) || 0}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] text-xs">
                        {closer?.full_name || "—"}
                        {ss.closed_at && (
                          <span className="block text-[10px] opacity-60">
                            {new Date(ss.closed_at).toLocaleString("en-ZA")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(!shiftStatuses || shiftStatuses.length === 0) && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                    >
                      No shift records found for the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── Generic department branch ────────────────────────────────────────────
  const { data: logs } = await supabase
    .from("daily_logs")
    .select("id, log_date, shift, notes, created_at")
    .eq("department_id", deptId)
    .gte("log_date", from)
    .lte("log_date", to)
    .order("log_date", { ascending: false })
    .returns<
      {
        id: string;
        log_date: string;
        shift: string;
        notes: string | null;
        created_at: string;
      }[]
    >();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text-heading)]">
          History
        </h2>
        <Link
          href={`/${deptSlug}/reports?from=${from}&to=${to}`}
          className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-cyan)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          Export CSV
        </Link>
      </div>

      {dateFilter}

      {/* Logs Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Shift
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Notes
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {logs?.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <td className="px-6 py-4 text-[var(--text-heading)] text-sm">
                    {log.log_date}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.shift === "day"
                          ? "bg-accent-blue/10 text-accent-blue"
                          : "bg-indigo-500/10 text-indigo-400"
                      }`}
                    >
                      {log.shift}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-muted)] text-sm truncate max-w-xs">
                    {log.notes || "—"}
                  </td>
                  <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                  >
                    No logs found for the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
