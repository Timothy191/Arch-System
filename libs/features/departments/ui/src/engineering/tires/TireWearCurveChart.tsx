"use client";

import { Card, Title, LineChart, Color } from "@tremor/react";
import { TrendingDown, ShieldAlert, Activity } from "lucide-react";
import type { WearCurvePoint } from "./types";

interface TireWearCurveChartProps {
  serialNumber?: string;
  brand?: string;
  data: WearCurvePoint[];
  currentTread?: number;
  criticalThreshold?: number;
  warningThreshold?: number;
}

export function TireWearCurveChart({
  serialNumber = "Fleet Aggregate",
  brand = "All Brands",
  data,
  currentTread,
  criticalThreshold = 15,
  warningThreshold = 25,
}: TireWearCurveChartProps) {
  const latestPoint = data[data.length - 1];
  const activeTread = currentTread ?? latestPoint?.treadDepth ?? 0;
  const isCritical = activeTread <= criticalThreshold;
  const isWarning = activeTread <= warningThreshold && !isCritical;

  // AGENT-TRACE: Calculate wear rate (mm / 100 hrs) if multi-point inspection data exists
  let wearRateFormatted = "—";
  let hoursRemainingFormatted = "—";

  if (data.length >= 2) {
    const first = data[0];
    const last = data[data.length - 1];
    if (first && last) {
      const deltaHours = last.hours - first.hours;
      const deltaWear = first.treadDepth - last.treadDepth;
      if (deltaHours > 0 && deltaWear > 0) {
        const ratePer100 = (deltaWear / deltaHours) * 100;
        wearRateFormatted = `${ratePer100.toFixed(2)} mm/100h`;
        const usableTread = activeTread - criticalThreshold;
        if (usableTread > 0) {
          const hoursLeft = (usableTread / deltaWear) * deltaHours;
          hoursRemainingFormatted = `~${Math.round(hoursLeft)} hrs`;
        } else {
          hoursRemainingFormatted = "0 hrs (Replace Now)";
        }
      }
    }
  }

  return (
    <Card className="bg-[var(--bg-primary)] border-[var(--border-default)] shadow-none p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-[var(--accent-blue)]" />
            <Title className="text-[var(--text-heading)] text-base font-semibold">
              Tread Wear Degradation Curve — {serialNumber}
            </Title>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Wear profile tracking against statutory warning (25mm) and critical scrap (15mm)
            thresholds.
          </p>
        </div>

        {/* Real-Time Wear Health Pill */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
              Current Tread
            </span>
            <span
              className={`text-sm font-bold ${
                isCritical ? "text-accent-red" : isWarning ? "text-amber-500" : "text-accent-green"
              }`}
            >
              {activeTread > 0 ? `${activeTread} mm` : "N/A"}
            </span>
          </div>

          <div className="flex flex-col text-right border-l border-[var(--border-default)] pl-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
              Wear Rate
            </span>
            <span className="text-sm font-semibold text-[var(--text-heading)]">
              {wearRateFormatted}
            </span>
          </div>

          <div className="flex flex-col text-right border-l border-[var(--border-default)] pl-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
              Est. Remaining Life
            </span>
            <span
              className={`text-sm font-semibold ${
                isCritical ? "text-accent-red" : "text-[var(--text-heading)]"
              }`}
            >
              {hoursRemainingFormatted}
            </span>
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <LineChart
          className="h-64 mt-2"
          data={data}
          index="date"
          categories={["treadDepth", "warningThreshold", "criticalThreshold"]}
          colors={["blue", "amber", "rose"] as Color[]}
          valueFormatter={(val: number) => `${val} mm`}
          showLegend={true}
          showGridLines={true}
          yAxisWidth={48}
        />
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[var(--bg-tertiary)]/40 rounded-xl border border-dashed border-[var(--border-default)]">
          <Activity className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-50" />
          <p className="text-sm font-medium text-[var(--text-heading)]">No Inspection History</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
            Log regular ultrasonic tread depth measurements to generate predictive degradation
            curves.
          </p>
        </div>
      )}
    </Card>
  );
}
