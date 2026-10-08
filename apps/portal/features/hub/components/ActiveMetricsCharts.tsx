'use client';

import { TelemetryChart } from '@repo/ui/components/ui/telemetry-chart';
import { useEffect, useState } from 'react';

const generateMockData = (baseValue: number, volatility: number, count: number) => {
  const data = [];
  let currentValue = baseValue;
  for (let i = 0; i < count; i++) {
    currentValue = Math.max(0, currentValue + (Math.random() - 0.5) * volatility);
    data.push({ timestamp: i, value: Math.round(currentValue) });
  }
  return data;
};

export function ActiveMetricsCharts() {
  const [breakdownData, setBreakdownData] = useState(() => generateMockData(12, 2, 20));
  const [incidentData, setIncidentData] = useState(() => generateMockData(5, 1, 20));
  const [efficiencyData, setEfficiencyData] = useState(() => generateMockData(85, 3, 20));

  useEffect(() => {
    const interval = setInterval(() => {
      setBreakdownData((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [
          ...prev.slice(1),
          {
            timestamp: (last.timestamp as number) + 1,
            value: Math.max(0, last.value + (Math.random() - 0.5) * 2),
          },
        ];
      });
      setIncidentData((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [
          ...prev.slice(1),
          {
            timestamp: (last.timestamp as number) + 1,
            value: Math.max(0, last.value + (Math.random() - 0.5) * 1),
          },
        ];
      });
      setEfficiencyData((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [
          ...prev.slice(1),
          {
            timestamp: (last.timestamp as number) + 1,
            value: Math.max(0, Math.min(100, last.value + (Math.random() - 0.5) * 3)),
          },
        ];
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 py-2">
      <TelemetryChart
        title="Active Breakdowns"
        unit="events"
        color="var(--accent-red)"
        data={breakdownData}
        height={160}
      />
      <TelemetryChart
        title="Incident Frequency"
        unit="incidents/hr"
        color="var(--accent-amber)"
        data={incidentData}
        height={160}
      />
      <TelemetryChart
        title="Overall Plant Efficiency"
        unit="%"
        color="var(--accent-green)"
        data={efficiencyData}
        height={160}
      />
    </div>
  );
}
