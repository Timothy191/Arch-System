"use client";

import { useState } from "react";
import type { STACItem, DeformationReading } from "@/lib/monitoring-api";
import {
  formatSceneDate,
  ALERT_THRESHOLDS,
  getSentinel1RevisitDates,
} from "@/lib/monitoring-api";
import { DeformationVelocityChart } from "./DeformationVelocityChart";

interface SARLayerPanelProps {
  scenes: STACItem[];
  readings?: DeformationReading[];
  onSceneSelect?: (_scene: STACItem) => void;
}

const COLORMAP_STEPS = [
  { label: "-50", color: "#7f1d1d" },
  { label: "-30", color: "#ef4444" },
  { label: "-15", color: "#1c1c1e" },
  { label: "-5", color: "#27272a" },
  { label: "0", color: "#3ecf8e" },
  { label: "+5", color: "#52525b" },
  { label: "+15", color: "#71717a" },
];

const AREA_LABELS: Record<string, string> = {
  "pit-wall": "Pit Wall",
  "tailings-dam": "Tailings Dam",
  "haul-road": "Haul Road",
  "processing-plant": "Processing Plant",
};

export function SARLayerPanel({
  scenes,
  readings = [],
  onSceneSelect,
}: SARLayerPanelProps) {
  const [selectedScene, setSelectedScene] = useState<string | null>(
    scenes[0]?.id ?? null,
  );
  const [selectedZone, setSelectedZone] = useState<DeformationReading | null>(
    readings.length > 0 ? readings[0]! : null,
  );

  const revisitDates = getSentinel1RevisitDates(new Date(), 6);

  function handleSelect(scene: STACItem) {
    setSelectedScene(scene.id);
    onSceneSelect?.(scene);
  }

  return (
    <div className="space-y-4">
      {/* InSAR Info Banner */}
      <div className="p-4 rounded-xl bg-accent-blue/10 border border-accent-blue/20">
        <div className="flex items-start gap-3">
          <span className="text-accent-blue text-xl mt-0.5">📡</span>
          <div>
            <p className="text-sm font-semibold text-accent-blue">
              Sentinel-1 SAR / InSAR
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              Synthetic Aperture Radar operates through clouds and at night.
              Differential InSAR (D-InSAR) measures millimetre-level ground
              deformation between acquisition pairs — critical for pit wall
              stability monitoring and tailings dam integrity assessments.
            </p>
          </div>
        </div>
      </div>

      {/* LOS Disclaimer — geotechnical standard requirement */}
      <div className="p-3 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-start gap-2">
        <span className="text-accent-blue text-sm mt-0.5 shrink-0">⚠</span>
        <p className="text-[11px] text-accent-blue/80 leading-relaxed">
          <strong>LOS displacement, not vertical:</strong> All deformation
          values are Line-of-Sight (LOS) measurements at the satellite's
          incidence angle (~38–40°). True vertical subsidence = LOS ÷
          cos(θ_inc). Decomposition into horizontal + vertical components
          requires ascending + descending passes.
        </p>
      </div>

      {/* Deformation Colormap Legend */}
      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
          LOS Deformation Colormap (mm)
        </p>
        <div className="flex items-center h-5 rounded overflow-hidden">
          {COLORMAP_STEPS.map((step) => (
            <div
              key={step.label}
              className="flex-1 h-full"
              style={{ background: step.color }}
              title={step.label}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {COLORMAP_STEPS.map((step) => (
            <span
              key={step.label}
              className="text-[9px] text-[var(--text-secondary)]"
            >
              {step.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
          Dark red = strong subsidence · Green = stable · Indigo = uplift
        </p>
      </div>

      {/* Alert Thresholds by area */}
      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Velocity Alert Thresholds (mm / month)
        </p>
        <table className="w-full text-[11px]">
          <thead>
            <tr>
              <th
                scope="col"
                className="text-left text-[var(--text-secondary)] pb-1.5 font-medium"
              >
                Area
              </th>
              <th
                scope="col"
                className="text-center text-accent-blue pb-1.5 font-medium"
              >
                Minor
              </th>
              <th
                scope="col"
                className="text-center text-accent-blue pb-1.5 font-medium"
              >
                Moderate
              </th>
              <th
                scope="col"
                className="text-center text-accent-red pb-1.5 font-medium"
              >
                Critical
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {(
              Object.entries(ALERT_THRESHOLDS) as [
                string,
                { minor: number; moderate: number; critical: number },
              ][]
            ).map(([area, t]) => (
              <tr key={area}>
                <td className="py-1 text-[var(--text-muted)]">
                  {AREA_LABELS[area] ?? area}
                </td>
                <td className="py-1 text-center text-accent-blue">
                  ≥{t.minor}
                </td>
                <td className="py-1 text-center text-accent-blue">
                  ≥{t.moderate}
                </td>
                <td className="py-1 text-center text-accent-red">
                  ≥{t.critical}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Zone velocity chart */}
      {readings.length > 0 && (
        <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Zone Velocity History
          </p>
          {/* Zone selector */}
          <div className="flex flex-wrap gap-1 mb-3">
            {readings.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedZone(r)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  selectedZone?.id === r.id
                    ? "bg-accent-blue/20 border-accent-blue/40 text-accent-blue"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                }`}
              >
                {r.location}
              </button>
            ))}
          </div>
          {selectedZone && (
            <>
              <DeformationVelocityChart
                history={selectedZone.history}
                area={selectedZone.area}
                height={90}
              />
              <p className="text-[10px] text-[var(--text-secondary)] mt-2">
                LOS incidence angle: {selectedZone.losAngleDeg}° · Vertical ≈
                LOS ÷ cos({selectedZone.losAngleDeg}°) ={" "}
                {Math.abs(
                  Math.round(
                    (selectedZone.velocityMmPerMonth /
                      Math.cos((selectedZone.losAngleDeg * Math.PI) / 180)) *
                      10,
                  ) / 10,
                )}{" "}
                mm/mo
              </p>
            </>
          )}
        </div>
      )}

      {/* 12-day revisit timeline */}
      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Sentinel-1 Acquisition Timeline (12-day cycle)
        </p>
        <div className="flex items-center gap-0">
          {revisitDates.map((date, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  i === 0
                    ? "bg-[#3ecf8e] border-[#3ecf8e]"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-emphasis)]"
                }`}
              />
              {i < revisitDates.length - 1 && <div className="absolute" />}
              <p className="text-[9px] text-[var(--text-secondary)] mt-1 text-center leading-tight">
                {date.toLocaleDateString("en-ZA", {
                  day: "2-digit",
                  month: "short",
                })}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-px bg-gradient-to-r from-[#3ecf8e] to-[var(--border-emphasis)]" />
          <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
            → 60 days
          </span>
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Sentinel-1A/B combined repeat: 6 days (when both satellites active)
        </p>
      </div>

      {/* Scene List */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Recent Sentinel-1 Acquisitions
        </p>
        {scenes.length === 0 ? (
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-center">
            <p className="text-[var(--text-secondary)] text-sm">
              Copernicus STAC — no scenes in bbox/timerange
            </p>
            <p className="text-[var(--text-secondary)] text-xs mt-1">
              Deformation readings from last processed InSAR pass shown on map
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => handleSelect(scene)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedScene === scene.id
                    ? "bg-accent-blue/10 border-accent-blue/30"
                    : "bg-[var(--bg-primary)] border-[var(--border-emphasis)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--text-heading)] font-medium font-mono truncate max-w-[160px]">
                    {scene.id.slice(0, 22)}…
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue shrink-0">
                    {scene.properties["s1:polarisation"] ?? "SAR"}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                  <span>{formatSceneDate(scene.properties.datetime)}</span>
                  <span>{scene.properties.platform ?? "Sentinel-1"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Technical footer */}
      <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)]">
        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
          Full InSAR time-series processing requires StaMPS, MintPy, or ISCE2
          pipelines. Pre-computed deformation estimates shown here — contact
          your geotechnical team for certified InSAR displacement reports per
          SANS/ISO 17123.
        </p>
      </div>
    </div>
  );
}
