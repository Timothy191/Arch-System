import { getDepartmentContext } from "~/lib/dept-context";
import { GlassCard } from "@repo/ui/GlassCard";
import { Input } from "@repo/ui/Input";
import Link from "next/link";
import { getShiftCompleteness } from "@/lib/shift-completeness";
import { CopyReportButton } from "./CopyReportButton";
import { ExportButton } from "@/features/analytics/components/ExportButton";
import { PDFDownloadButton } from "@/features/analytics/components/PDFDownloadButton";

export default async function ReportsPage({
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

  const todayStr = new Date().toISOString().split("T")[0]!;
  const toDateStr = toParam || todayStr;
  const fromDateStr =
    fromParam ||
    new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const isControlRoom = dept.type === "control_room";

  // ─── Control Room branch ───────────────────────────────────────────────────
  if (isControlRoom) {
    const [
      { data: operations },
      { data: loads },
      { data: delays },
      { data: excavatorAssignments },
      { data: dozerRolls },
    ] = await Promise.all([
      supabase
        .from("machine_operations")
        .select("shift_date, shift_type, hours_worked")
        .eq("department_id", deptId)
        .gte("shift_date", fromDateStr)
        .lte("shift_date", toDateStr)
        .order("shift_date", { ascending: false }),
      supabase
        .from("hourly_loads")
        .select("load_date, shift_type, total_loads")
        .eq("department_id", deptId)
        .gte("load_date", fromDateStr)
        .lte("load_date", toDateStr),
      supabase
        .from("operational_delays")
        .select("delay_date, shift_type, delay_minutes")
        .eq("department_id", deptId)
        .gte("delay_date", fromDateStr)
        .lte("delay_date", toDateStr),
      supabase
        .from("excavator_dumper_assignments")
        .select(
          "total_bcm, excavator_activity!inner(activity_date, shift_type, department_id, site:sites(name))",
        )
        .eq("excavator_activity.department_id", deptId)
        .gte("excavator_activity.activity_date", fromDateStr)
        .lte("excavator_activity.activity_date", toDateStr),
      supabase
        .from("dozer_rolls")
        .select("roll_date, shift_type, blade_passes, hours_operated")
        .eq("department_id", deptId)
        .gte("roll_date", fromDateStr)
        .lte("roll_date", toDateStr),
    ]);

    // Aggregate totals for KPIs
    const totalHours =
      operations?.reduce((sum, o) => sum + (o.hours_worked || 0), 0) || 0;
    const totalLoads =
      loads?.reduce((sum, l) => sum + (l.total_loads || 0), 0) || 0;
    const totalDelayMin =
      delays?.reduce((sum, d) => sum + (d.delay_minutes || 0), 0) || 0;
    const totalBcm =
      excavatorAssignments?.reduce((sum, a) => sum + (a.total_bcm || 0), 0) ||
      0;

    // Build per-(site, date, shift) row map
    type CRRow = {
      site: string;
      date: string;
      shift: string;
      hours: number;
      loads: number;
      bcm: number;
      delayMin: number;
      dozerPasses: number;
    };
    const rowMap = new Map<string, CRRow>();

    const key = (site: string, date: string, shift: string) =>
      `${site}|${date}|${shift}`;

    const getOrCreate = (site: string, date: string, shift: string): CRRow => {
      const k = key(site, date, shift);
      if (!rowMap.has(k)) {
        rowMap.set(k, {
          site,
          date,
          shift,
          hours: 0,
          loads: 0,
          bcm: 0,
          delayMin: 0,
          dozerPasses: 0,
        });
      }
      return rowMap.get(k)!;
    };

    operations?.forEach((o) => {
      getOrCreate("", o.shift_date, o.shift_type).hours += o.hours_worked || 0;
    });
    loads?.forEach((l) => {
      getOrCreate("", l.load_date, l.shift_type).loads += l.total_loads || 0;
    });
    delays?.forEach((d) => {
      getOrCreate("", d.delay_date, d.shift_type).delayMin +=
        d.delay_minutes || 0;
    });
    excavatorAssignments?.forEach((a) => {
      const act = Array.isArray(a.excavator_activity)
        ? a.excavator_activity[0]
        : a.excavator_activity;
      if (act) {
        const rawSite = (act as unknown as { site?: unknown }).site;
        const siteObj = Array.isArray(rawSite)
          ? ((rawSite as { name: string }[])[0]?.name ?? "")
          : ((rawSite as { name: string } | null | undefined)?.name ?? "");
        getOrCreate(siteObj, act.activity_date, act.shift_type).bcm +=
          a.total_bcm || 0;
      }
    });
    dozerRolls?.forEach((r) => {
      getOrCreate("", r.roll_date, r.shift_type).dozerPasses +=
        r.blade_passes || 0;
    });

    const rows = Array.from(rowMap.values()).sort((a, b) => {
      if (a.site !== b.site) return a.site.localeCompare(b.site);
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.shift.localeCompare(b.shift);
    });

    const csvRows = [
      [
        "Site",
        "Date",
        "Shift",
        "Hours",
        "Total Loads",
        "BCM",
        "Delay (min)",
        "Dozer Passes",
      ],
      ...rows.map((r) => [
        r.site || "—",
        r.date,
        r.shift,
        r.hours.toFixed(2),
        r.loads.toString(),
        r.bcm.toFixed(2),
        r.delayMin.toString(),
        r.dozerPasses.toString(),
      ]),
    ];

    const csvContent = csvRows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const exportRows = rows.map((r) => ({
      Site: r.site || "—",
      Date: r.date,
      Shift: r.shift,
      Hours: Number(r.hours.toFixed(2)),
      "Total Loads": r.loads,
      BCM: Number(r.bcm.toFixed(2)),
      "Delay (min)": r.delayMin,
      "Dozer Passes": r.dozerPasses,
    }));

    const pdfReportData = {
      title: `${dept.displayName} Department Report`,
      subtitle: `Generated on ${todayStr} — Date range: ${fromDateStr} to ${toDateStr}`,
      kpis: [
        { label: "Total Hours", value: `${totalHours.toFixed(1)} h` },
        { label: "Total Loads", value: `${totalLoads.toLocaleString()}` },
        { label: "Total BCM", value: `${totalBcm.toFixed(1)}` },
        { label: "Delay Minutes", value: `${totalDelayMin.toLocaleString()}` },
      ],
      tableHeaders: [
        "Site",
        "Date",
        "Shift",
        "Hours",
        "Loads",
        "BCM",
        "Delay (min)",
        "Dozer Passes",
      ],
      tableRows: exportRows.map((r) => [
        r.Site,
        r.Date,
        r.Shift,
        r.Hours.toString(),
        r["Total Loads"].toString(),
        r.BCM.toString(),
        r["Delay (min)"].toString(),
        r["Dozer Passes"].toString(),
      ]),
    };

    // ── Shift completeness gate ──────────────────────────────────────────────
    const currentHour = new Date().getHours();
    const currentShift: "day" | "night" =
      currentHour >= 6 && currentHour < 18 ? "day" : "night";

    const completeness = await getShiftCompleteness(
      supabase,
      deptId,
      deptSlug,
      todayStr,
      currentShift,
    );

    if (!completeness.complete) {
      const missing = completeness.statuses.filter(
        (s) => !s.exempt && !s.hasEntry,
      );
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[var(--text-heading)]">
              Reports
            </h2>
          </div>
          <GlassCard className="border-accent-red/30 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-red mt-1 shrink-0" />
              <div>
                <p className="text-[var(--text-heading)] font-medium">
                  Shift report cannot be generated
                </p>
                <p className="text-[var(--text-muted)] text-sm mt-0.5">
                  {missing.length} machine
                  {missing.length !== 1 ? "s are" : " is"} missing entries for
                  the current {currentShift} shift. Complete all entries first.
                </p>
              </div>
            </div>
            <div className="divide-y divide-[var(--border-default)] rounded-lg overflow-hidden border border-[var(--border-default)]">
              {missing.map((s) => (
                <div
                  key={s.machineId}
                  className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)]"
                >
                  <div>
                    <p className="text-[var(--text-heading)] text-sm font-medium">
                      {s.machineName}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs">
                      {s.machineType}
                    </p>
                  </div>
                  <Link
                    href={s.formPath}
                    className="text-[var(--accent-cyan)] text-sm hover:underline"
                  >
                    → {s.formLabel}
                  </Link>
                </div>
              ))}
            </div>
            <Link
              href={`/${deptSlug}/machine-operations`}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-cyan)] hover:underline"
            >
              View full coverage checklist →
            </Link>
          </GlassCard>
        </div>
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">
            Reports
          </h2>
          <div className="flex items-center gap-2">
            <CopyReportButton csvContent={csvContent} />
            <PDFDownloadButton
              reportData={pdfReportData}
              departmentId={deptId}
            />
            <ExportButton
              filename={`control-room-report-${fromDateStr}-to-${toDateStr}`}
              rows={exportRows}
            />
          </div>
        </div>

        {/* CR KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard>
            <p className="text-[var(--text-muted)] text-sm">Total Hours</p>
            <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
              {totalHours.toFixed(1)}h
            </p>
          </GlassCard>
          <GlassCard>
            <p className="text-[var(--text-muted)] text-sm">Total Loads</p>
            <p className="text-2xl font-medium text-[var(--accent-cyan)] mt-1">
              {totalLoads.toLocaleString()}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="text-[var(--text-muted)] text-sm">Total BCM</p>
            <p className="text-2xl font-medium text-accent-green mt-1">
              {totalBcm.toFixed(1)}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="text-[var(--text-muted)] text-sm">Delay Minutes</p>
            <p className="text-2xl font-medium text-accent-blue mt-1">
              {totalDelayMin.toLocaleString()}
            </p>
          </GlassCard>
        </div>

        {/* Date Filter */}
        <GlassCard>
          <form method="GET" className="flex items-end gap-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">
                From
              </label>
              <Input
                type="date"
                name="from"
                defaultValue={fromDateStr}
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
                defaultValue={toDateStr}
                className="px-4 py-2"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-heading)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              Update
            </button>
          </form>
        </GlassCard>

        {/* CR Report Table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  {[
                    "Site",
                    "Date",
                    "Shift",
                    "Hours",
                    "Loads",
                    "BCM",
                    "Delay (min)",
                    "Dozer Passes",
                  ].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider ${i > 2 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {rows.map((row) => (
                  <tr
                    key={`${row.site}-${row.date}-${row.shift}`}
                    className="hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                      {row.site ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20">
                          {row.site}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-heading)] text-sm">
                      {row.date}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.shift === "day"
                            ? "bg-accent-blue/10 text-accent-blue"
                            : "bg-indigo-500/10 text-indigo-400"
                        }`}
                      >
                        {row.shift}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm text-right">
                      {row.hours.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-[var(--accent-cyan)] text-sm text-right">
                      {row.loads.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-accent-green text-sm text-right">
                      {row.bcm.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-accent-blue text-sm text-right">
                      {row.delayMin}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm text-right">
                      {row.dozerPasses.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                    >
                      No data found for the selected date range.
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
    .select("id, log_date, shift, notes")
    .eq("department_id", deptId)
    .gte("log_date", fromDateStr)
    .lte("log_date", toDateStr)
    .order("log_date", { ascending: false });

  const logIds = logs?.map((l) => l.id) || [];

  const [{ data: machineHours }, { data: fuelLogs }, { data: productionLogs }] =
    await Promise.all([
      logIds.length > 0
        ? supabase
            .from("machine_hours")
            .select("daily_log_id, hours_worked")
            .in("daily_log_id", logIds)
        : Promise.resolve({ data: [] }),
      logIds.length > 0
        ? supabase
            .from("fuel_logs")
            .select("daily_log_id, diesel_litres")
            .in("daily_log_id", logIds)
        : Promise.resolve({ data: [] }),
      logIds.length > 0
        ? supabase
            .from("production_logs")
            .select("daily_log_id, coal_tonnes, waste_tonnes")
            .in("daily_log_id", logIds)
        : Promise.resolve({ data: [] }),
    ]);

  const totalHours =
    machineHours?.reduce((sum, m) => sum + (m.hours_worked || 0), 0) || 0;
  const totalFuel =
    fuelLogs?.reduce((sum, f) => sum + (f.diesel_litres || 0), 0) || 0;
  const totalCoal =
    productionLogs?.reduce((sum, p) => sum + (p.coal_tonnes || 0), 0) || 0;
  const totalWaste =
    productionLogs?.reduce((sum, p) => sum + (p.waste_tonnes || 0), 0) || 0;

  const machineHoursByLog = new Map<string, number>();
  machineHours?.forEach((m) => {
    machineHoursByLog.set(
      m.daily_log_id,
      (machineHoursByLog.get(m.daily_log_id) || 0) + (m.hours_worked || 0),
    );
  });

  const fuelLogsByLog = new Map<string, number>();
  fuelLogs?.forEach((f) => {
    fuelLogsByLog.set(
      f.daily_log_id,
      (fuelLogsByLog.get(f.daily_log_id) || 0) + (f.diesel_litres || 0),
    );
  });

  const productionByLog = new Map<
    string,
    { coal_tonnes: number; waste_tonnes: number }
  >();
  productionLogs?.forEach((p) => {
    productionByLog.set(p.daily_log_id, p);
  });

  const csvRows = [
    [
      "Date",
      "Shift",
      "Notes",
      "Total Hours",
      "Total Fuel (L)",
      "Coal (t)",
      "Waste (t)",
    ],
    ...(logs || []).map((log) => {
      const mh = machineHoursByLog.get(log.id) || 0;
      const fl = fuelLogsByLog.get(log.id) || 0;
      const pl = productionByLog.get(log.id);
      return [
        log.log_date,
        log.shift,
        log.notes || "",
        mh.toFixed(2),
        fl.toFixed(2),
        (pl?.coal_tonnes || 0).toFixed(2),
        (pl?.waste_tonnes || 0).toFixed(2),
      ];
    }),
  ];

  const csvContent = csvRows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const exportRows = (logs || []).map((log) => {
    const mh = machineHoursByLog.get(log.id) || 0;
    const fl = fuelLogsByLog.get(log.id) || 0;
    const pl = productionByLog.get(log.id);
    return {
      Date: log.log_date,
      Shift: log.shift,
      Notes: log.notes || "",
      "Total Hours": Number(mh.toFixed(2)),
      "Total Fuel (L)": Number(fl.toFixed(2)),
      "Coal (t)": Number((pl?.coal_tonnes || 0).toFixed(2)),
      "Waste (t)": Number((pl?.waste_tonnes || 0).toFixed(2)),
    };
  });

  const pdfReportData = {
    title: `${dept.displayName} Department Report`,
    subtitle: `Generated on ${todayStr} — Date range: ${fromDateStr} to ${toDateStr}`,
    kpis: [
      { label: "Total Machine Hours", value: `${totalHours.toFixed(1)} h` },
      { label: "Diesel Consumed (L)", value: `${totalFuel.toFixed(1)} L` },
      { label: "Coal Removed (t)", value: `${totalCoal.toFixed(1)} t` },
      { label: "Waste Removed (t)", value: `${totalWaste.toFixed(1)} t` },
    ],
    tableHeaders: [
      "Date",
      "Shift",
      "Hours",
      "Fuel (L)",
      "Coal (t)",
      "Waste (t)",
    ],
    tableRows: exportRows.map((r) => [
      r.Date,
      r.Shift,
      r["Total Hours"].toString(),
      r["Total Fuel (L)"].toString(),
      r["Coal (t)"].toString(),
      r["Waste (t)"].toString(),
    ]),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text-heading)]">
          Reports
        </h2>
        <div className="flex items-center gap-2">
          <CopyReportButton csvContent={csvContent} />
          <PDFDownloadButton reportData={pdfReportData} departmentId={deptId} />
          <ExportButton
            filename={`${deptSlug}-report-${fromDateStr}-to-${toDateStr}`}
            rows={exportRows}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">
            Total Machine Hours
          </p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {totalHours.toFixed(1)}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">
            Diesel Consumed (L)
          </p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {totalFuel.toFixed(1)}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Coal Removed (t)</p>
          <p className="text-2xl font-medium text-accent-green mt-1">
            {totalCoal.toFixed(1)}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Waste Removed (t)</p>
          <p className="text-2xl font-medium text-accent-blue mt-1">
            {totalWaste.toFixed(1)}
          </p>
        </GlassCard>
      </div>

      {/* Date Filter */}
      <GlassCard>
        <form method="GET" className="flex items-end gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">
              From
            </label>
            <Input
              type="date"
              name="from"
              defaultValue={fromDateStr}
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
              defaultValue={toDateStr}
              className="px-4 py-2"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-heading)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Update
          </button>
        </form>
      </GlassCard>

      {/* Report Table */}
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
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Hours
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Fuel (L)
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Coal (t)
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Waste (t)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {logs?.map((log) => {
                const mh = machineHoursByLog.get(log.id) || 0;
                const fl = fuelLogsByLog.get(log.id) || 0;
                const pl = productionByLog.get(log.id);
                return (
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
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm text-right">
                      {mh.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm text-right">
                      {fl.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-accent-green text-sm text-right">
                      {(pl?.coal_tonnes || 0).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-accent-blue text-sm text-right">
                      {(pl?.waste_tonnes || 0).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                  >
                    No data found for the selected date range.
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
