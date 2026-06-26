"use client";

import dynamic from "next/dynamic";
import { SatelliteMonitoringDashboard } from "@repo/departments/ui";
// AGENT-TRACE: Portal-side wrapper that injects monitoring components into the lib's
// SatelliteMonitoringDashboard, decoupling the lib from @/components/monitoring/* imports.

const LidarLayerPanel = dynamic(
  () => import("@/components/monitoring/LidarLayer").then((m) => m.LidarLayerPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl animate-pulse" />
    ),
  },
);

const COGRasterLayer = dynamic(
  () => import("@/components/monitoring/COGRasterLayer").then((m) => m.COGRasterLayer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl animate-pulse" />
    ),
  },
);

const KeplerGlMap = dynamic(
  () => import("@/components/monitoring/KeplerGlMap").then((m) => m.KeplerGlMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl animate-pulse" />
    ),
  },
);

const MonitoringMap = dynamic(
  () => import("@/components/monitoring/MonitoringMap").then((m) => m.MonitoringMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#3ecf8e] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)] text-sm">Loading satellite map…</p>
        </div>
      </div>
    ),
  },
);

type ActiveTab = "overview" | "sar" | "hyperspectral" | "highres" | "lidar" | "raster" | "kepler";

interface SatelliteDashboardPortalProps {
  defaultTab?: ActiveTab;
}

export function SatelliteDashboardPortal({
  defaultTab = "overview",
}: SatelliteDashboardPortalProps) {
  return (
    <SatelliteMonitoringDashboard
      defaultTab={defaultTab}
      monitoring={{ LidarLayerPanel, COGRasterLayer, KeplerGlMap, MonitoringMap }}
    />
  );
}
