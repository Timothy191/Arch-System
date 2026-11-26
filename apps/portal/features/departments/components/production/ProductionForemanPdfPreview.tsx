'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { CalendarDays, Download, FileText, Loader2, Printer } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { downloadProductionForemanPdf } from './production-pdf-export';
import type { ProductionPdfScope, ProductionPerformanceData } from './production-types';

export interface ProductionForemanPdfPreviewProps {
  performance: ProductionPerformanceData;
}

type ZoomLevel = 'fit' | '100' | '75';

interface SegmentOption<TOption extends string> {
  readonly value: TOption;
  readonly label: string;
}

const SCOPE_OPTIONS: readonly SegmentOption<ProductionPdfScope>[] = [
  { value: 'full', label: 'Full Report' },
  { value: 'foreman-delays', label: 'Foreman & Delays' },
  { value: 'daily-monthly', label: 'Daily & Monthly' },
];

const SCOPE_LABELS: Record<ProductionPdfScope, string> = {
  full: 'Foreman, Daily & Monthly vs Delays',
  'foreman-delays': 'Foreman Summary & Combined Delays',
  'daily-monthly': 'Daily & Monthly vs Delays',
};

const ZOOM_OPTIONS: readonly SegmentOption<ZoomLevel>[] = [
  { value: 'fit', label: 'Fit' },
  { value: '100', label: '100%' },
  { value: '75', label: '75%' },
];

const ZOOM_STYLES: Record<ZoomLevel, CSSProperties> = {
  fit: { width: '210mm', maxWidth: '100%' },
  '100': { width: '210mm', transform: 'scale(1)', transformOrigin: 'top center' },
  '75': { width: '210mm', transform: 'scale(0.75)', transformOrigin: 'top center' },
};

const EYEBROW_CLASS =
  'font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-[0.18em]';
const PILL_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 font-medium text-[var(--text-secondary)] text-xs';
const SEGMENT_GROUP_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1';
const SEGMENT_BASE_CLASS = 'rounded-md px-3 py-1.5 font-medium text-xs transition';
const SEGMENT_ACTIVE_CLASS = 'bg-[var(--accent-blue)] text-[var(--bg-primary)] shadow-sm';
const SEGMENT_INACTIVE_CLASS =
  'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]';
const BTN_SECONDARY_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs shadow-sm transition hover:border-[var(--accent-blue)]';
const BTN_PRIMARY_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-[var(--bg-primary)] text-xs shadow-md transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60';
const PAPER_CLASS =
  'mx-auto flex min-h-[297mm] flex-col gap-5 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] p-[12mm] text-[var(--text-heading)] shadow-md print:rounded-none print:border-0 print:shadow-none';
const SECTION_TITLE_CLASS =
  'mb-2 border-[var(--border-default)] border-b pb-1 font-bold text-[11px] text-[var(--text-heading)] uppercase tracking-wide';
const TH_CLASS =
  'border-[var(--border-default)] border-b bg-[var(--bg-secondary)] px-2 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase';
const TH_NUM_CLASS =
  'border-[var(--border-default)] border-b bg-[var(--bg-secondary)] px-2 py-1.5 text-right font-semibold text-[10px] text-[var(--text-secondary)] uppercase';
const TD_CLASS = 'border-[var(--border-subtle)] border-b px-2 py-1.5 align-top text-[11px]';
const TD_NUM_CLASS = `${TD_CLASS} text-right tabular-nums`;
const KPI_CARD_CLASS =
  'flex flex-col gap-0.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2';
const MUTED_TEXT_CLASS = 'text-[10px] text-[var(--text-muted)]';

function SegmentedControl<TOption extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly SegmentOption<TOption>[];
  selected: TOption;
  onSelect: (next: TOption) => void;
}) {
  return (
    <div role="group" aria-label={label} className={SEGMENT_GROUP_CLASS}>
      {options.map((option) => {
        const isActive = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(option.value)}
            className={`${SEGMENT_BASE_CLASS} ${isActive ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProductionForemanPdfPreview({ performance }: ProductionForemanPdfPreviewProps) {
  const [scope, setScope] = useState<ProductionPdfScope>('full');
  const [zoom, setZoom] = useState<ZoomLevel>('fit');
  const [isGenerating, setIsGenerating] = useState(false);

  const { foremanSummary, delayGroups, dailyRows, monthlyRows } = performance;
  const showForemanAndDelays = scope === 'full' || scope === 'foreman-delays';
  const showDailyAndMonthly = scope === 'full' || scope === 'daily-monthly';

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await downloadProductionForemanPdf({ performance, scope });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <GlassCard variant="window" className="print:hidden">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className={EYEBROW_CLASS}>PRODUCTION · FOREMAN PDF STUDIO</span>
              <h3 className="font-bold text-[var(--text-heading)] text-xl">
                Foreman Production vs Combined Delays PDF
              </h3>
              <p className="max-w-2xl text-[var(--text-secondary)] text-sm">
                Executive Pit BCM, ROM Coal, Waste, Rollover, and Combined Delay report across
                Foreman, Daily, and Monthly horizons (excludes machine-by-machine SMU tables).
              </p>
            </div>
            <span className={PILL_CLASS}>
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Report Period: {performance.monthLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="PDF scope"
              options={SCOPE_OPTIONS}
              selected={scope}
              onSelect={setScope}
            />
            <SegmentedControl
              label="Preview zoom"
              options={ZOOM_OPTIONS}
              selected={zoom}
              onSelect={setZoom}
            />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => window.print()} className={BTN_SECONDARY_CLASS}>
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print A4
              </button>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={isGenerating}
                className={BTN_PRIMARY_CLASS}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {isGenerating ? 'Preparing PDF…' : 'Download PDF Report'}
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      <p className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs print:hidden">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Live A4 preview — mirrors the downloadable vector PDF.
      </p>

      <div className="flex justify-center overflow-x-auto pb-6">
        <article
          aria-label="Production Foreman PDF Report Preview"
          className={PAPER_CLASS}
          style={ZOOM_STYLES[zoom]}
        >
          <header className="flex items-end justify-between gap-6 border-[var(--text-heading)] border-b-2 pb-3">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10" />
              <div className="flex flex-col">
                <span className={EYEBROW_CLASS}>ARCH OS · PRODUCTION DEPARTMENT</span>
                <h4 className="font-bold text-2xl text-[var(--text-heading)]">
                  Foreman Production vs Combined Delays Report
                </h4>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-3 text-right text-[10px]">
              <dt className="text-[var(--text-muted)]">Report Month</dt>
              <dd className="font-semibold">{performance.selectedMonth}</dd>
              <dt className="text-[var(--text-muted)]">Document ID</dt>
              <dd className="font-semibold">PRD-FRM-{performance.selectedMonth}</dd>
              <dt className="text-[var(--text-muted)]">Scope</dt>
              <dd className="font-semibold">{SCOPE_LABELS[scope]}</dd>
            </dl>
          </header>

          <section aria-label="Foreman KPI summary" className="grid grid-cols-4 gap-2">
            <div className={KPI_CARD_CLASS}>
              <span className="font-semibold text-[9px] text-[var(--text-muted)] uppercase">
                Pit BCM Moved
              </span>
              <span className="font-bold text-[var(--text-heading)] text-base tabular-nums">
                {foremanSummary.totalPitBcm.toLocaleString('en-US')} BCM
              </span>
              <span className={MUTED_TEXT_CLASS}>
                Target: {foremanSummary.pitBcmTarget.toLocaleString('en-US')} (
                {foremanSummary.pitBcmAttainmentPct}%)
              </span>
            </div>
            <div className={KPI_CARD_CLASS}>
              <span className="font-semibold text-[9px] text-[var(--text-muted)] uppercase">
                ROM Coal &amp; Waste
              </span>
              <span className="font-bold text-[var(--text-heading)] text-base tabular-nums">
                {foremanSummary.totalCoalTonnes.toLocaleString('en-US')} t
              </span>
              <span className={MUTED_TEXT_CLASS}>
                Waste: {foremanSummary.totalWasteTonnes.toLocaleString('en-US')} t
              </span>
            </div>
            <div className={KPI_CARD_CLASS}>
              <span className="font-semibold text-[9px] text-[var(--text-muted)] uppercase">
                Loads &amp; Rollover
              </span>
              <span className="font-bold text-[var(--text-heading)] text-base tabular-nums">
                {foremanSummary.totalHaulLoads.toLocaleString('en-US')} loads
              </span>
              <span className={MUTED_TEXT_CLASS}>
                Rollover: {foremanSummary.totalRolloverBcm.toLocaleString('en-US')} BCM
              </span>
            </div>
            <div className={KPI_CARD_CLASS}>
              <span className="font-semibold text-[9px] text-[var(--text-muted)] uppercase">
                Combined Delays
              </span>
              <span className="font-bold text-[var(--accent-amber)] text-base tabular-nums">
                {foremanSummary.totalCombinedDelayHours.toFixed(1)} hrs
              </span>
              <span className={MUTED_TEXT_CLASS}>
                Productive Efficiency: {foremanSummary.productiveEfficiencyPct}%
              </span>
            </div>
          </section>

          {showForemanAndDelays && (
            <>
              <section className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                <h5 className={SECTION_TITLE_CLASS}>Foreman Executive Production Summary</h5>
                <p className="text-[11px]">{foremanSummary.supervisorSummary}</p>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  {foremanSummary.pitBenchProgress}
                </p>
              </section>

              <section>
                <h5 className={SECTION_TITLE_CLASS}>Production vs Combined Delays Breakdown</h5>
                <table
                  aria-label="Production vs Combined Delays Breakdown"
                  className="w-full border-collapse"
                >
                  <thead>
                    <tr>
                      <th scope="col" className={TH_CLASS}>
                        Delay Group
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Delay Hours
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Delay Minutes
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Share %
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Est. Pit BCM Impact
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {delayGroups.map((group) => (
                      <tr key={group.key}>
                        <td className={`${TD_CLASS} font-semibold`}>{group.label}</td>
                        <td className={TD_NUM_CLASS}>{group.delayHours.toFixed(1)} h</td>
                        <td className={TD_NUM_CLASS}>{group.delayMinutes}</td>
                        <td className={TD_NUM_CLASS}>{group.sharePct.toFixed(1)}%</td>
                        <td className={TD_NUM_CLASS}>
                          {group.estimatedPitBcmImpact.toLocaleString('en-US')} BCM
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {showDailyAndMonthly && (
            <>
              <section>
                <h5 className={SECTION_TITLE_CLASS}>Daily Production vs Combined Delays Ledger</h5>
                <table
                  aria-label="Daily Production vs Combined Delays Ledger"
                  className="w-full border-collapse"
                >
                  <thead>
                    <tr>
                      <th scope="col" className={TH_CLASS}>
                        Date
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Pit BCM
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Haul Loads
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Rollover BCM
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Coal / Waste (t)
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Delays (hrs)
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Variance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((row) => (
                      <tr key={row.date} className={row.hasData ? '' : 'opacity-65'}>
                        <td className={`${TD_CLASS} font-mono`}>{row.date}</td>
                        <td className={TD_NUM_CLASS}>
                          {row.hasData ? row.pitBcm.toLocaleString('en-US') : '—'}
                        </td>
                        <td className={TD_NUM_CLASS}>
                          {row.hasData ? row.haulLoads.toLocaleString('en-US') : '—'}
                        </td>
                        <td className={TD_NUM_CLASS}>
                          {row.hasData ? row.rolloverBcm.toLocaleString('en-US') : '—'}
                        </td>
                        <td className={TD_NUM_CLASS}>
                          {row.hasData
                            ? `${row.coalTonnes.toLocaleString('en-US')} / ${row.wasteTonnes.toLocaleString('en-US')}`
                            : '—'}
                        </td>
                        <td className={TD_NUM_CLASS}>
                          {row.hasData ? row.combinedDelayHours.toFixed(1) : '—'}
                        </td>
                        <td className={TD_NUM_CLASS}>
                          {row.hasData
                            ? `${row.pitBcmVariance >= 0 ? '+' : ''}${row.pitBcmVariance.toLocaleString('en-US')}`
                            : 'No data'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section>
                <h5 className={SECTION_TITLE_CLASS}>Monthly Production vs Delays Summary</h5>
                <table
                  aria-label="Monthly Production vs Delays Summary"
                  className="w-full border-collapse"
                >
                  <thead>
                    <tr>
                      <th scope="col" className={TH_CLASS}>
                        Month
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Pit BCM
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Coal (t)
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Waste (t)
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Loads
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Rollover
                      </th>
                      <th scope="col" className={TH_NUM_CLASS}>
                        Combined Delays
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((row) => (
                      <tr key={row.month}>
                        <td className={`${TD_CLASS} font-semibold`}>{row.monthLabel}</td>
                        <td className={TD_NUM_CLASS}>
                          {row.pitBcm.toLocaleString('en-US')} ({row.pitBcmAttainmentPct}%)
                        </td>
                        <td className={TD_NUM_CLASS}>{row.coalTonnes.toLocaleString('en-US')}</td>
                        <td className={TD_NUM_CLASS}>{row.wasteTonnes.toLocaleString('en-US')}</td>
                        <td className={TD_NUM_CLASS}>{row.haulLoads.toLocaleString('en-US')}</td>
                        <td className={TD_NUM_CLASS}>{row.rolloverBcm.toLocaleString('en-US')}</td>
                        <td className={TD_NUM_CLASS}>{row.combinedDelayHours.toFixed(1)} hrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          <section aria-label="Sign-off" className="mt-auto grid grid-cols-3 gap-8 pt-6">
            {['Production Foreman', 'Mine Overseer', 'Approval Date'].map((role) => (
              <div key={role} className="border-[var(--text-heading)] border-t pt-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase">{role}</span>
              </div>
            ))}
          </section>

          <footer className="flex justify-between border-[var(--border-default)] border-t pt-2">
            <span className={MUTED_TEXT_CLASS}>
              Plantcor / Arch OS · Production Foreman &amp; Combined Delays Report
            </span>
            <span className={MUTED_TEXT_CLASS}>Page 1 of 1</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
