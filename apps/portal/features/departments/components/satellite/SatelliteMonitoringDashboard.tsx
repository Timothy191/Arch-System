"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { SARLayerPanel } from "./SARLayer";
import {
  HyperspectralLayer,
  type SpectralComposite,
} from "./HyperspectralLayer";
import { HighResPanel } from "./HighResPanel";
import { DeformationSummary } from "./DeformationAlertCard";
import {
  generateDeformationReadings,
  DEFAULT_MINE_CENTER,
  DEFAULT_MINE_BBOX,
  type DeformationReading,
} from "@/lib/monitoring-api";

const LidarLayerPanel = dynamic(
  () =>
    import("@/components/monitoring/LidarLayer").then((m) => m.LidarLayerPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl animate-pulse" />
    ),
  },
);

const COGRasterLayer = dynamic(
  () =>
    import("@/components/monitoring/COGRasterLayer").then(
      (m) => m.COGRasterLayer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl animate-pulse" />
    ),
  },
);

const KeplerGlMap = dynamic(
  () =>
    import("@/components/monitoring/KeplerGlMap").then((m) => m.KeplerGlMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl animate-pulse" />
    ),
  },
);

const MonitoringMap = dynamic(
  () =>
    import("@/components/monitoring/MonitoringMap").then(
      (m) => m.MonitoringMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#3ecf8e] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)] text-sm">
            Loading satellite map…
          </p>
        </div>
      </div>
    ),
  },
);

type ActiveTab =
  | "overview"
  | "sar"
  | "hyperspectral"
  | "highres"
  | "lidar"
  | "raster"
  | "kepler";
type MapLayer = "none" | "sar" | "optical" | "ndvi" | "geology" | "terrain";

const TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "🌍" },
  { id: "sar", label: "SAR / InSAR", icon: "📡" },
  { id: "hyperspectral", label: "Hyperspectral", icon: "🌈" },
  { id: "highres", label: "High-Res Imagery", icon: "🛰️" },
  { id: "lidar", label: "LiDAR", icon: "📐" },
  { id: "raster", label: "COG Raster", icon: "🗺️" },
  { id: "kepler", label: "Kepler.gl", icon: "🌐" },
];

const TAB_LAYER_MAP: Record<ActiveTab, MapLayer> = {
  overview: "optical",
  sar: "sar",
  hyperspectral: "ndvi",
  highres: "optical",
  lidar: "terrain",
  raster: "optical",
  kepler: "optical",
};

const readings = generateDeformationReadings(
  DEFAULT_MINE_CENTER.lat,
  DEFAULT_MINE_CENTER.lon,
);

interface SatelliteMonitoringDashboardProps {
  defaultTab?: ActiveTab;
}

export function SatelliteMonitoringDashboard({
  defaultTab = "overview",
}: SatelliteMonitoringDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab);
  const [activeComposite, setActiveComposite] =
    useState<SpectralComposite>("truecolor");
  const [selectedReading, setSelectedReading] =
    useState<DeformationReading | null>(null);

  const critical = readings.filter((r) => r.level === "critical").length;
  const moderate = readings.filter((r) => r.level === "moderate").length;
  const minor = readings.filter((r) => r.level === "minor").length;
  const stable = readings.filter((r) => r.level === "stable").length;

  const compositeToLayer: Record<SpectralComposite, MapLayer> = {
    truecolor: "optical",
    falsecolor: "optical",
    ndvi: "ndvi",
    geology: "geology",
  };

  const mapLayer: MapLayer =
    activeTab === "hyperspectral"
      ? compositeToLayer[activeComposite]
      : TAB_LAYER_MAP[activeTab];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-heading)]">
            Advanced Satellite Monitoring
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            SAR / InSAR · Hyperspectral · High-Resolution Imagery · Copernicus /
            ESA
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
            <span className="w-2 h-2 rounded-full bg-[#3ecf8e] animate-pulse" />
            <span className="text-xs text-[var(--text-secondary)]">
              Sentinel-1 — 12-day cycle
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
            <span className="text-[10px] text-[var(--text-secondary)]">
              S2 last pass:
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-medium">
              {new Date(Date.now() - 3 * 86400000).toLocaleDateString("en-ZA", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Critical
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${critical > 0 ? "text-accent-red" : "text-[#3ecf8e]"}`}
          >
            {critical}
          </p>
          <p className="text-[var(--text-secondary)] text-xs mt-0.5">
            deformation alerts
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Moderate
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${moderate > 0 ? "text-accent-blue" : "text-[var(--text-heading)]"}`}
          >
            {moderate}
          </p>
          <p className="text-[var(--text-secondary)] text-xs mt-0.5">
            zones monitored
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Minor
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${minor > 0 ? "text-accent-blue" : "text-[var(--text-heading)]"}`}
          >
            {minor}
          </p>
          <p className="text-[var(--text-secondary)] text-xs mt-0.5">
            within threshold
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Stable
          </p>
          <p className="text-2xl font-bold text-[#3ecf8e] mt-1">{stable}</p>
          <p className="text-[var(--text-secondary)] text-xs mt-0.5">
            no movement
          </p>
        </GlassCard>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 p-1 bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-[#3ecf8e] text-[var(--text-heading)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main content: map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left: map + detail */}
        <div className="space-y-4">
          <MonitoringMap
            center={DEFAULT_MINE_CENTER}
            zoom={12}
            deformationReadings={readings}
            activeLayer={mapLayer}
            height="480px"
            onReadingClick={setSelectedReading}
          />

          {selectedReading && (
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-base font-semibold text-[var(--text-heading)]">
                  📍 {selectedReading.location}
                </p>
                <button
                  onClick={() => setSelectedReading(null)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-heading)] text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">Shift</p>
                  <p className="text-[var(--text-heading)] font-medium">
                    {selectedReading.shiftMm > 0 ? "+" : ""}
                    {selectedReading.shiftMm} mm
                  </p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">Trend</p>
                  <p className="text-[var(--text-heading)] font-medium capitalize">
                    {selectedReading.trend}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">Area</p>
                  <p className="text-[var(--text-heading)] font-medium capitalize">
                    {selectedReading.area.replace(/-/g, " ")}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">Sensor</p>
                  <p className="text-[var(--text-heading)] font-medium">
                    {selectedReading.sensor}
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Overview bbox info */}
          {activeTab === "overview" && (
            <GlassCard className="p-4">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Site Bounding Box
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">W: </span>
                  <span className="text-[var(--text-heading)]">
                    {DEFAULT_MINE_BBOX.west}°
                  </span>
                </div>
                <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">E: </span>
                  <span className="text-[var(--text-heading)]">
                    {DEFAULT_MINE_BBOX.east}°
                  </span>
                </div>
                <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">S: </span>
                  <span className="text-[var(--text-heading)]">
                    {DEFAULT_MINE_BBOX.south}°
                  </span>
                </div>
                <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">N: </span>
                  <span className="text-[var(--text-heading)]">
                    {DEFAULT_MINE_BBOX.north}°
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-2">
                Configure in{" "}
                <code className="text-[#3ecf8e]">lib/monitoring-api.ts</code> →{" "}
                <code className="text-[#3ecf8e]">DEFAULT_MINE_BBOX</code>
              </p>
            </GlassCard>
          )}
        </div>

        {/* Right: contextual panel */}
        <div className="overflow-y-auto max-h-[900px] space-y-0">
          {activeTab === "overview" && (
            <DeformationSummary
              readings={readings}
              onReadingClick={setSelectedReading}
            />
          )}
          {activeTab === "sar" && (
            <SARLayerPanel scenes={[]} readings={readings} />
          )}
          {activeTab === "hyperspectral" && (
            <HyperspectralLayer
              scenes={[]}
              activeComposite={activeComposite}
              onCompositeChange={setActiveComposite}
            />
          )}
          {activeTab === "highres" && <HighResPanel scenes={[]} />}
          {activeTab === "lidar" && <LidarLayerPanel />}
          {activeTab === "raster" && <COGRasterLayer />}
          {activeTab === "kepler" && <KeplerGlMap />}
        </div>
      </div>
      {/* Geotechnical / ISO disclaimer */}
      <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] mt-2">
        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-muted)]">Disclaimer:</strong> All
          InSAR displacement values are Line-of-Sight (LOS) at Sentinel-1
          incidence angle (~38–40°) and are indicative only. Vertical
          decomposition requires multi-geometry processing (StaMPS / MintPy /
          ISCE2). This tool does not replace certified geotechnical monitoring
          (SANS 10160 / ISO 17123). Critical alerts must be verified by a
          qualified geotechnical engineer before any operational decision. Tile
          imagery © EOX IT Services GmbH · Sentinel data © ESA Copernicus
          Programme.
        </p>
      </div>
    </div>
  );
}
