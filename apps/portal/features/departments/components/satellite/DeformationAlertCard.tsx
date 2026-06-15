"use client";

import type { DeformationReading } from "@/lib/monitoring-api";

interface DeformationAlertCardProps {
  reading: DeformationReading;
  onClick?: (_reading: DeformationReading) => void;
}

const LEVEL_CONFIG = {
  stable: {
    bg: "bg-accent-green/10",
    border: "border-accent-green/30",
    text: "text-accent-green",
    badge: "bg-accent-green/20 text-accent-green",
    dot: "bg-accent-green",
    label: "Stable",
  },
  minor: {
    bg: "bg-accent-blue/10",
    border: "border-accent-blue/30",
    text: "text-accent-blue",
    badge: "bg-accent-blue/20 text-accent-blue",
    dot: "bg-accent-blue",
    label: "Minor Shift",
  },
  moderate: {
    bg: "bg-accent-blue/10",
    border: "border-accent-blue/30",
    text: "text-accent-blue",
    badge: "bg-accent-blue/20 text-accent-blue",
    dot: "bg-accent-blue",
    label: "Moderate",
  },
  critical: {
    bg: "bg-accent-red/10",
    border: "border-accent-red/30",
    text: "text-accent-red",
    badge: "bg-accent-red/20 text-accent-red",
    dot: "bg-accent-red animate-pulse",
    label: "CRITICAL",
  },
};

const AREA_ICONS: Record<string, string> = {
  "pit-wall": "🪨",
  "tailings-dam": "🏗️",
  "haul-road": "🛣️",
  "processing-plant": "🏭",
};

const TREND_ICONS: Record<string, string> = {
  subsiding: "↓",
  stable: "→",
  uplifting: "↑",
};

function DeformationAlertCard({ reading, onClick }: DeformationAlertCardProps) {
  const cfg = LEVEL_CONFIG[reading.level];

  return (
    <button
      onClick={() => onClick?.(reading)}
      className={`w-full text-left p-4 rounded-xl border ${cfg.bg} ${cfg.border} transition-all hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-[var(--border-emphasis)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="text-sm font-medium text-[var(--text-heading)] truncate">
            {AREA_ICONS[reading.area]} {reading.location}
          </span>
        </div>
        <span
          className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}
        >
          {cfg.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className={`text-xl font-bold tabular-nums ${cfg.text}`}>
            {reading.shiftMm > 0 ? "+" : ""}
            {reading.shiftMm.toFixed(1)} mm
            <span className="ml-1 text-base">{TREND_ICONS[reading.trend]}</span>
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {reading.sensor}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-secondary)] capitalize">
            {reading.trend}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {new Date(reading.lastUpdated).toLocaleDateString("en-ZA", {
              day: "2-digit",
              month: "short",
            })}
          </p>
        </div>
      </div>
    </button>
  );
}

interface DeformationSummaryProps {
  readings: DeformationReading[];
  onReadingClick?: (_reading: DeformationReading) => void;
}

export function DeformationSummary({
  readings,
  onReadingClick,
}: DeformationSummaryProps) {
  const criticalCount = readings.filter((r) => r.level === "critical").length;
  const moderateCount = readings.filter((r) => r.level === "moderate").length;
  const sortedReadings = [...readings].sort((a, b) => {
    const order = { critical: 0, moderate: 1, minor: 2, stable: 3 };
    return order[a.level] - order[b.level];
  });

  return (
    <div className="space-y-3">
      {(criticalCount > 0 || moderateCount > 0) && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            criticalCount > 0
              ? "bg-accent-red/10 border border-accent-red/30 text-accent-red"
              : "bg-accent-blue/10 border border-accent-blue/30 text-accent-blue"
          }`}
        >
          <span>⚠</span>
          <span>
            {criticalCount > 0
              ? `${criticalCount} critical deformation alert${criticalCount > 1 ? "s" : ""} — immediate review required`
              : `${moderateCount} moderate shift${moderateCount > 1 ? "s" : ""} detected — monitor closely`}
          </span>
        </div>
      )}
      <div className="space-y-2">
        {sortedReadings.map((reading) => (
          <DeformationAlertCard
            key={reading.id}
            reading={reading}
            onClick={onReadingClick}
          />
        ))}
      </div>
    </div>
  );
}
