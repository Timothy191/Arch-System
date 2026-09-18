import { GlassCard } from "@repo/ui/GlassCard";

/**
 * Material ledger — the executive hero.
 *
 * Renders the month-to-date tonnage as a strip-ratio composition: a single
 * proportional bar splitting coal (product) from waste (spoil), flanked by
 * ledger columns. Every figure uses the telemetry face (Roboto Mono,
 * tabular); labels stay sentence-case sans per docs/DESIGN.md §3.
 */

type DriftColor = "emerald" | "amber" | "orange" | "red";

// Static class maps — Tailwind can't see dynamic constructions.
const CHIP_STYLES: Record<DriftColor, { pill: string; dot: string }> = {
  emerald: { pill: "bg-accent-green/10 text-accent-green", dot: "bg-accent-green" },
  amber: { pill: "bg-accent-amber/10 text-accent-amber", dot: "bg-accent-amber" },
  orange: { pill: "bg-accent-amber/10 text-accent-amber", dot: "bg-accent-amber" },
  red: { pill: "bg-accent-red/10 text-accent-red", dot: "bg-accent-red" },
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export interface TonnageLedgerProps {
  totalTonnage: number;
  totalCoal: number;
  totalWaste: number;
  avgDriftPct: number;
  driftLabel: string;
  driftColor: string;
  fuelPerTonne: string;
  totalFuelLitres: number;
  totalHours: number;
}

export function TonnageLedger({
  totalTonnage,
  totalCoal,
  totalWaste,
  avgDriftPct,
  driftLabel,
  driftColor,
  fuelPerTonne,
  totalFuelLitres,
  totalHours,
}: TonnageLedgerProps) {
  const chip = CHIP_STYLES[driftColor as DriftColor] ?? CHIP_STYLES.red!;
  const coalPct = totalTonnage > 0 ? (totalCoal / totalTonnage) * 100 : 0;
  const wastePct = totalTonnage > 0 ? (totalWaste / totalTonnage) * 100 : 0;
  const empty = totalTonnage <= 0;

  return (
    <GlassCard
      variant="liquid"
      className="p-6 md:p-8 animate-window-open"
      data-testid="tonnage-ledger"
    >
      {/* Ledger heading + reconciliation status */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--text-muted)]">Material ledger</p>
        <span
          data-testid="drift-chip"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-fluid-xs font-medium ${chip.pill}`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
          {driftLabel}
          <span className="font-mono tabular-nums">{avgDriftPct.toFixed(1)}%</span>
        </span>
      </div>

      {empty ? (
        <p className="mt-6 text-fluid-lg text-[var(--text-muted)]">
          No material recorded yet this month — figures appear with the first daily logs.
        </p>
      ) : (
        <>
          {/* Hero figure */}
          <div className="mt-5">
            <p className="font-mono text-fluid-6xl font-medium tabular-nums leading-none text-[var(--text-heading)]">
              {fmt(totalTonnage)}
            </p>
            <p className="mt-2 text-fluid-sm text-[var(--text-muted)]">
              tonnes moved month to date
            </p>
          </div>

          {/* Strip-ratio split bar — segment widths are the composition */}
          <div
            className="mt-6 h-3 w-full overflow-hidden rounded-full bg-arch2"
            role="img"
            aria-label={`Coal ${coalPct.toFixed(1)} percent of material moved, waste ${wastePct.toFixed(1)} percent`}
          >
            <div className="flex h-full w-full">
              <div
                data-testid="ledger-coal-segment"
                className="h-full bg-accent-green"
                style={{ width: `${coalPct}%` }}
              />
              <div
                data-testid="ledger-waste-segment"
                className="h-full bg-arch3"
                style={{ width: `${wastePct}%` }}
              />
            </div>
          </div>

          {/* Ledger columns — coal / waste */}
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] font-medium text-[var(--text-heading)]">Coal</p>
              <p className="font-mono text-fluid-lg tabular-nums text-[var(--text-muted)]">
                {fmt(totalCoal)} t
              </p>
              <p className="font-mono text-fluid-sm tabular-nums text-accent-green">
                {coalPct.toFixed(1)}%
              </p>
            </div>
            <div className="justify-self-end text-right">
              <p className="text-[13px] font-medium text-[var(--text-heading)]">Waste</p>
              <p className="font-mono text-fluid-lg tabular-nums text-[var(--text-muted)]">
                {fmt(totalWaste)} t
              </p>
              <p className="font-mono text-fluid-sm tabular-nums text-[var(--text-muted)]">
                {wastePct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Secondary figures — quiet hairline row */}
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-arch2 pt-5 md:grid-cols-4">
            <div>
              <dt className="text-fluid-xs text-[var(--text-muted)]">Reconciliation drift</dt>
              <dd className="mt-0.5 font-mono text-fluid-lg font-medium tabular-nums text-[var(--text-heading)]">
                {avgDriftPct.toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt className="text-fluid-xs text-[var(--text-muted)]">Fuel efficiency</dt>
              <dd className="mt-0.5 font-mono text-fluid-lg font-medium tabular-nums text-[var(--text-heading)]">
                {fuelPerTonne} L/t
              </dd>
            </div>
            <div>
              <dt className="text-fluid-xs text-[var(--text-muted)]">Diesel consumed</dt>
              <dd className="mt-0.5 font-mono text-fluid-lg font-medium tabular-nums text-[var(--text-heading)]">
                {fmt(totalFuelLitres)} L
              </dd>
            </div>
            <div>
              <dt className="text-fluid-xs text-[var(--text-muted)]">Machine hours</dt>
              <dd className="mt-0.5 font-mono text-fluid-lg font-medium tabular-nums text-[var(--text-heading)]">
                {fmt(totalHours)} h
              </dd>
            </div>
          </dl>
        </>
      )}
    </GlassCard>
  );
}
