import { GlassSkeleton } from '@repo/ui/components/ui/glass-skeleton';

export interface DepartmentPageLoadingSkeletonProps {
  readonly cardCount?: 3 | 4;
  readonly hasSecondaryPanel?: boolean;
}

const DEFAULT_CARD_COUNT = 3;
const HEADER_ROWS = 2;
const CARD_ROWS = 2;
const PANEL_ROWS = 1;
const THREE_CARD_KEYS = ['kpi-1', 'kpi-2', 'kpi-3'] as const;
const FOUR_CARD_KEYS = ['kpi-1', 'kpi-2', 'kpi-3', 'kpi-4'] as const;

export function DepartmentPageLoadingSkeleton({
  cardCount = DEFAULT_CARD_COUNT,
  hasSecondaryPanel = false,
}: DepartmentPageLoadingSkeletonProps) {
  const cardKeys = cardCount === DEFAULT_CARD_COUNT ? THREE_CARD_KEYS : FOUR_CARD_KEYS;
  const gridClass =
    cardCount === DEFAULT_CARD_COUNT
      ? 'grid grid-cols-1 gap-4 md:grid-cols-3'
      : 'grid grid-cols-2 gap-4 md:grid-cols-4';

  return (
    <div className="space-y-6">
      <GlassSkeleton showHeader rows={HEADER_ROWS} />
      <div className={gridClass}>
        {cardKeys.map((key) => (
          <GlassSkeleton key={key} rows={CARD_ROWS} />
        ))}
      </div>
      <GlassSkeleton className="h-96" rows={PANEL_ROWS} />
      {hasSecondaryPanel && <GlassSkeleton className="h-64" rows={PANEL_ROWS} />}
    </div>
  );
}
