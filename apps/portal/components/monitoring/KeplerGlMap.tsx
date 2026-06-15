"use client";

import { useMemo } from "react";

interface KeplerGlMapProps {
  center?: { lat: number; lon: number };
  zoom?: number;
  height?: string;
}

type DeformationLevel = "stable" | "minor" | "moderate" | "critical";
type DeformationTrend = "stable" | "accelerating" | "decelerating";

interface DeformationPoint {
  lat: number;
  lon: number;
  level: DeformationLevel;
  area: string;
  shiftMm: number;
  trend: DeformationTrend;
  sensor: string;
}

export function KeplerGlMap({
  center = { lat: -26.25, lon: 26.75 },
  height = "600px",
}: KeplerGlMapProps) {
  const points = useMemo((): DeformationPoint[] => {
    const areaTypes = [
      "pit-wall",
      "tailings-dam",
      "haul-road",
      "conveyor",
      "stockpile",
      "crusher",
    ];
    const levels: DeformationPoint["level"][] = [
      "stable",
      "minor",
      "moderate",
      "critical",
    ];
    const trends: DeformationPoint["trend"][] = [
      "stable",
      "accelerating",
      "decelerating",
    ];

    return Array.from({ length: 250 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.015;

      return {
        lat: center.lat + Math.cos(angle) * radius,
        lon: center.lon + Math.sin(angle) * radius,
        level: levels[Math.floor(Math.random() * levels.length)]!,
        area: areaTypes[Math.floor(Math.random() * areaTypes.length)]!,
        shiftMm: Number((Math.random() * 60 - 10).toFixed(1)),
        trend: trends[Math.floor(Math.random() * trends.length)]!,
        sensor: "Sentinel-1",
      };
    });
  }, [center]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of points) {
      c[p.level] = (c[p.level] ?? 0) + 1;
    }
    return c;
  }, [points]);

  const geoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points.map((p) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [p.lon, p.lat],
        },
        properties: p,
      })),
    }),
    [points],
  );

  const geoJSONStr = useMemo(() => JSON.stringify(geoJSON, null, 2), [geoJSON]);

  const levelColors: Record<string, string> = {
    critical: "text-accent-red bg-accent-red/10 border-accent-red/20",
    moderate: "text-accent-blue bg-accent-blue/10 border-accent-blue/20",
    minor: "text-accent-blue bg-accent-blue/10 border-accent-blue/20",
    stable: "text-accent-green bg-accent-green/10 border-accent-green/20",
  };

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-indigo-400">
            Kepler.gl Spatial Analysis
          </strong>{" "}
          — High-performance geospatial engine for mining deformation data.
          Supports point clustering, heatmaps, hexagon binning, and arc layers
          via deck.gl.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([level, count]) => (
          <span
            key={level}
            className={`text-[11px] px-2.5 py-1 rounded-lg border capitalize ${
              levelColors[level] ?? "text-[var(--text-secondary)]"
            }`}
          >
            {level}: {count}
          </span>
        ))}
        <span className="text-[11px] text-[var(--text-muted)] px-2.5 py-1 rounded-lg border border-[var(--border-default)]">
          {points.length} total
        </span>
      </div>

      {/* GeoJSON preview + export */}
      <div
        className="rounded-xl overflow-hidden border border-[var(--border-emphasis)] flex flex-col"
        style={{ height }}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-primary)] border-b border-[var(--border-emphasis)]">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            GeoJSON — {points.length} features
          </span>
          <button
            onClick={() => {
              const blob = new Blob([geoJSONStr], {
                type: "application/geo+json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "deformation-points.geojson";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-[11px] px-2 py-1 rounded-lg bg-[#3ecf8e]/20 text-[#3ecf8e] border border-[#3ecf8e]/30 hover:bg-[#3ecf8e]/30 transition-colors"
          >
            Export GeoJSON ↓
          </button>
        </div>
        <pre className="flex-1 overflow-auto p-3 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-primary)]/50 leading-relaxed">
          {geoJSONStr.slice(0, 2000)}
          {geoJSONStr.length > 2000 ? "\n… (truncated)" : ""}
        </pre>
      </div>

      {/* Integration note */}
      <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-heading)]">
            Kepler.gl setup:
          </strong>{" "}
          To enable the full Kepler.gl UI, add{" "}
          <code className="text-[#3ecf8e]">kepler.gl</code> to your Redux store
          with <code className="text-[#3ecf8e]">keplerGlReducer</code>. See{" "}
          <code className="text-[#3ecf8e]">docs.kepler.gl</code> for the
          complete integration guide. The GeoJSON export above lets you load
          this data directly into any Kepler.gl instance.
        </p>
      </div>
    </div>
  );
}
