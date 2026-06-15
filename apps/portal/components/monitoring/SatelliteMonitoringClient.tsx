"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { DeformationSummary } from "@/features/departments/components/satellite/DeformationAlertCard";
import {
  DEFAULT_MINE_CENTER,
  type DeformationReading,
} from "@/lib/monitoring-api";

const MonitoringMap = dynamic(
  () => import("./MonitoringMap").then((m) => m.MonitoringMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl animate-pulse" />
    ),
  },
);

interface SatelliteMonitoringClientProps {
  readings: DeformationReading[];
}

export function SatelliteMonitoringClient({
  readings,
}: SatelliteMonitoringClientProps) {
  const [selectedReading, setSelectedReading] =
    useState<DeformationReading | null>(null);

  return (
    <>
      {/* Map */}
      <MonitoringMap
        center={DEFAULT_MINE_CENTER}
        zoom={12}
        deformationReadings={readings}
        activeLayer="optical"
        height="340px"
        onReadingClick={setSelectedReading}
      />

      {/* Selected reading detail */}
      {selectedReading && (
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[var(--text-heading)]">
              {selectedReading.location}
            </p>
            <button
              onClick={() => setSelectedReading(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-heading)] text-xs"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Shift:{" "}
            <span className="text-[var(--text-heading)]">
              {selectedReading.shiftMm} mm
            </span>{" "}
            · Trend:{" "}
            <span className="text-[var(--text-heading)] capitalize">
              {selectedReading.trend}
            </span>{" "}
            · Area:{" "}
            <span className="text-[var(--text-heading)] capitalize">
              {selectedReading.area.replace("-", " ")}
            </span>
          </p>
        </GlassCard>
      )}

      {/* Alert list */}
      <DeformationSummary
        readings={readings}
        onReadingClick={setSelectedReading}
      />
    </>
  );
}
