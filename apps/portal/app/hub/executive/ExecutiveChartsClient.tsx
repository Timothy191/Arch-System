'use client';

import { ExecutiveOperationsCharts, type OperationsChartsProps } from './ExecutiveOperationsCharts';
import { ExecutiveProductionCharts, type ProductionChartsProps } from './ExecutiveProductionCharts';

export type ExecutiveChartsProps = ProductionChartsProps & OperationsChartsProps;

/** Client-only chart island (recharts) — loaded lazily via `ExecutiveChartsLazy`. */
export function ExecutiveChartsClient({
  summaryAvailable,
  daily,
  mtd,
  avgDailyTonnes,
  fleet,
  breakdowns,
  personnelByDepartment,
}: ExecutiveChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ExecutiveProductionCharts
        summaryAvailable={summaryAvailable}
        daily={daily}
        mtd={mtd}
        avgDailyTonnes={avgDailyTonnes}
      />
      <ExecutiveOperationsCharts
        fleet={fleet}
        breakdowns={breakdowns}
        personnelByDepartment={personnelByDepartment}
      />
    </div>
  );
}
