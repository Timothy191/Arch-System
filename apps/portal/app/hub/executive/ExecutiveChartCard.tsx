import { GlassCard } from '@repo/ui/GlassCard';
import type { ReactNode } from 'react';
import { useId } from 'react';

export type ChartState = 'ready' | 'empty' | 'unavailable';

export interface LegendEntry {
  label: string;
  color: string;
  detail?: string;
}

interface ChartCardProps {
  title: string;
  description: string;
  state: ChartState;
  emptyMessage?: string;
  legend?: readonly LegendEntry[];
  className?: string;
  children: ReactNode;
}

const UNAVAILABLE_MESSAGE =
  'Unavailable while the production summary query is failing — figures are hidden, not zeroed.';
const DEFAULT_EMPTY_MESSAGE = 'No records for this period yet.';
const PLACEHOLDER_CLASS =
  'flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] px-4 text-center text-[var(--text-muted)] text-sm';

export function chartStateFor(isSourceAvailable: boolean, hasRows: boolean): ChartState {
  if (!isSourceAvailable) return 'unavailable';
  return hasRows ? 'ready' : 'empty';
}

function ChartLegend({ entries }: { entries: readonly LegendEntry[] }) {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-muted)] text-xs"
    >
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.label}</span>
          {entry.detail ? (
            <span className="font-medium text-[var(--text-heading)] tabular-nums">
              {entry.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Shared chart shell: heading, accessible description, legend and empty/unavailable states. */
export function ChartCard({
  title,
  description,
  state,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  legend,
  className,
  children,
}: ChartCardProps) {
  const baseId = useId();
  const placeholder = state === 'unavailable' ? UNAVAILABLE_MESSAGE : emptyMessage;
  return (
    <GlassCard className={className}>
      <figure
        aria-labelledby={`${baseId}-title`}
        aria-describedby={`${baseId}-desc`}
        className="space-y-3"
      >
        <div className="space-y-1">
          <h3 id={`${baseId}-title`} className="font-semibold text-[var(--text-heading)] text-sm">
            {title}
          </h3>
          <p id={`${baseId}-desc`} className="text-[var(--text-muted)] text-xs">
            {description}
          </p>
        </div>
        {state === 'ready' && legend ? <ChartLegend entries={legend} /> : null}
        {state === 'ready' ? children : <p className={PLACEHOLDER_CLASS}>{placeholder}</p>}
      </figure>
    </GlassCard>
  );
}
