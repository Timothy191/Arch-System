"use client";

import Image from "next/image";
import { useState, useMemo } from "react";
import type { STACItem } from "@/lib/monitoring-api";
import { formatSceneDate, getSTACQuicklookUrl } from "@/lib/monitoring-api";

interface HighResPanelProps {
  scenes: STACItem[];
}

const USE_CASES = [
  {
    icon: "🚜",
    title: "Equipment Tracking",
    description:
      "Sub-meter imagery detects individual haul trucks, excavators, and dozers to verify shift compliance and utilisation.",
  },
  {
    icon: "⛏️",
    title: "Excavation Volume",
    description:
      "Multi-temporal DEM differencing calculates how much material has been extracted between acquisition dates.",
  },
  {
    icon: "🏗️",
    title: "Infrastructure Change",
    description:
      "Detect new stockpiles, road extensions, or dam embankment changes across the site perimeter.",
  },
  {
    icon: "💧",
    title: "Water Body Mapping",
    description:
      "Track pit dewatering, tailings pond levels, and nearby drainage courses for environmental compliance.",
  },
];

const PROVIDERS = [
  {
    name: "Sentinel-2 (ESA/Copernicus)",
    resolution: "10m",
    revisit: "5 days",
    cost: "Free",
    key: false,
    api: "Copernicus STAC",
  },
  {
    name: "Planet Labs (PlanetScope)",
    resolution: "3m",
    revisit: "Daily",
    cost: "Paid (edu free)",
    key: true,
    api: "Planet API v1",
  },
  {
    name: "Maxar WorldView",
    resolution: "0.3m",
    revisit: "< 1 day",
    cost: "Paid",
    key: true,
    api: "Maxar GBDX",
  },
  {
    name: "Airbus Pleiades",
    resolution: "0.5m",
    revisit: "< 1 day",
    cost: "Paid",
    key: true,
    api: "Airbus Intelligence",
  },
];

const BULK_DENSITIES: Record<string, number> = {
  "Ore (mixed)": 2.4,
  "Waste rock": 2.2,
  Coal: 0.85,
  "Tailings (dry)": 1.6,
  "Tailings (wet)": 1.9,
  "Topsoil (stripped)": 1.4,
};

export function HighResPanel({ scenes }: HighResPanelProps) {
  const [selectedScene, setSelectedScene] = useState<string | null>(
    scenes[0]?.id ?? null,
  );

  const [baseElev, setBaseElev] = useState<string>("1250");
  const [peakElev, setPeakElev] = useState<string>("1278");
  const [areaHa, setAreaHa] = useState<string>("2.4");
  const [material, setMaterial] = useState<string>("Ore (mixed)");

  const [cdFrom, setCdFrom] = useState<string>("");
  const [cdTo, setCdTo] = useState<string>("");

  const stockpileResult = useMemo(() => {
    const base = parseFloat(baseElev);
    const peak = parseFloat(peakElev);
    const area = parseFloat(areaHa);
    const density = BULK_DENSITIES[material] ?? 2.0;
    if (isNaN(base) || isNaN(peak) || isNaN(area) || peak <= base) return null;
    const avgHeight = (peak - base) * 0.6;
    const volumeM3 = area * 10000 * avgHeight * 0.33;
    const tonnage = volumeM3 * density;
    return { volumeM3: Math.round(volumeM3), tonnage: Math.round(tonnage) };
  }, [baseElev, peakElev, areaHa, material]);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-accent-green/10 border border-accent-green/20">
        <div className="flex items-start gap-3">
          <span className="text-accent-green text-xl mt-0.5">🛰️</span>
          <div>
            <p className="text-sm font-semibold text-accent-green">
              High-Resolution Commercial Imagery
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              CubeSat constellations (Planet Labs, Maxar, Airbus) image the site
              daily at 0.3–3 m. DEM differencing between acquisition dates
              calculates excavation volumes and stockpile tonnage without ground
              survey. Sentinel-2 (10 m, free) used here as baseline.
            </p>
          </div>
        </div>
      </div>

      {/* Stockpile Volume Estimator */}
      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Stockpile Volume Estimator
        </p>
        <p className="text-[10px] text-[var(--text-secondary)] mb-3">
          Conical approximation from DEM-derived base + peak elevation and
          mapped area. For certified survey use LiDAR or photogrammetric point
          cloud.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">
              Base elevation (m)
            </label>
            <input
              type="number"
              value={baseElev}
              onChange={(e) => setBaseElev(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">
              Peak elevation (m)
            </label>
            <input
              type="number"
              value={peakElev}
              onChange={(e) => setPeakElev(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">
              Footprint area (ha)
            </label>
            <input
              type="number"
              value={areaHa}
              onChange={(e) => setAreaHa(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">
              Material type
            </label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            >
              {Object.keys(BULK_DENSITIES).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        {stockpileResult ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-[var(--bg-primary)] rounded-lg">
              <p className="text-[10px] text-[var(--text-secondary)]">
                Volume (m³)
              </p>
              <p className="text-lg font-bold text-[var(--accent-green)]">
                {stockpileResult.volumeM3.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 bg-[var(--bg-primary)] rounded-lg">
              <p className="text-[10px] text-[var(--text-secondary)]">
                Tonnage (t)
              </p>
              <p className="text-lg font-bold text-[var(--text-heading)]">
                {stockpileResult.tonnage.toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-accent-blue">
            Peak elevation must be greater than base elevation.
          </p>
        )}
      </div>

      {/* Change Detection Date Selector */}
      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Change Detection Period
        </p>
        <p className="text-[10px] text-[var(--text-secondary)] mb-3">
          Select two dates to compare imagery and detect stockpile movement, new
          infrastructure, or tailings pond level changes.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">
              From date
            </label>
            <input
              type="date"
              value={cdFrom}
              onChange={(e) => setCdFrom(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">
              To date
            </label>
            <input
              type="date"
              value={cdTo}
              onChange={(e) => setCdTo(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
        </div>
        {cdFrom && cdTo && cdTo > cdFrom ? (
          <div className="p-2 bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 rounded-lg">
            <p className="text-[11px] text-[var(--accent-green)]">
              ✓ Period selected:{" "}
              {Math.round(
                (new Date(cdTo).getTime() - new Date(cdFrom).getTime()) /
                  86400000,
              )}{" "}
              days
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              Order Planet/Maxar archive imagery for this window to run DEM
              differencing.
            </p>
          </div>
        ) : cdFrom && cdTo ? (
          <p className="text-[10px] text-accent-blue">
            "To" date must be after "From" date.
          </p>
        ) : null}
      </div>

      {/* Use Cases */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Mining Applications
        </p>
        <div className="grid grid-cols-1 gap-2">
          {USE_CASES.map((uc) => (
            <div
              key={uc.title}
              className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]"
            >
              <span className="text-xl shrink-0">{uc.icon}</span>
              <div>
                <p className="text-sm font-medium text-[var(--text-heading)]">
                  {uc.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {uc.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Comparison */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Imagery Providers
        </p>
        <div className="rounded-xl border border-[var(--border-emphasis)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg-tertiary)]">
                <th
                  scope="col"
                  className="text-left p-2.5 text-[var(--text-secondary)] font-medium"
                >
                  Provider
                </th>
                <th
                  scope="col"
                  className="text-left p-2.5 text-[var(--text-secondary)] font-medium"
                >
                  GSD
                </th>
                <th
                  scope="col"
                  className="text-left p-2.5 text-[var(--text-secondary)] font-medium"
                >
                  Revisit
                </th>
                <th
                  scope="col"
                  className="text-left p-2.5 text-[var(--text-secondary)] font-medium"
                >
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p, i) => (
                <tr
                  key={p.name}
                  className={`border-t border-[var(--border-emphasis)] ${i % 2 === 0 ? "bg-[var(--bg-primary)]" : "bg-[var(--bg-secondary)]"}`}
                >
                  <td className="p-2.5 text-[var(--text-heading)]">
                    <span className="text-[11px]">{p.name}</span>
                    {p.key && (
                      <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-accent-blue/20 text-accent-blue">
                        API KEY
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-[var(--text-muted)] text-[11px]">
                    {p.resolution}
                  </td>
                  <td className="p-2.5 text-[var(--text-muted)] text-[11px]">
                    {p.revisit}
                  </td>
                  <td className="p-2.5 text-[11px]">
                    <span
                      className={
                        p.cost === "Free"
                          ? "text-[var(--accent-green)]"
                          : "text-[var(--text-secondary)]"
                      }
                    >
                      {p.cost}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Latest scenes */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Latest Copernicus Scenes
        </p>
        {scenes.length === 0 ? (
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-center">
            <p className="text-[var(--text-secondary)] text-sm">
              No recent scenes available
            </p>
            <p className="text-[var(--text-secondary)] text-xs mt-1">
              Add Planet/Maxar API keys in Settings for daily sub-metre imagery
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {scenes.slice(0, 4).map((scene) => {
              const cloud = scene.properties["eo:cloud_cover"];
              const quicklook = getSTACQuicklookUrl(scene);
              return (
                <button
                  key={scene.id}
                  onClick={() =>
                    setSelectedScene(
                      scene.id === selectedScene ? null : scene.id,
                    )
                  }
                  className={`w-full text-left rounded-xl border transition-colors overflow-hidden ${
                    selectedScene === scene.id
                      ? "bg-accent-green/10 border-accent-green/30"
                      : "bg-[var(--bg-primary)] border-[var(--border-emphasis)] hover:bg-[var(--bg-tertiary)]"
                  }`}
                >
                  {quicklook && selectedScene === scene.id && (
                    <Image
                      src={quicklook}
                      alt="Scene quicklook preview"
                      className="w-full h-20 object-cover"
                      loading="lazy"
                      width={320}
                      height={80}
                      unoptimized
                    />
                  )}
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-[var(--text-heading)] font-medium font-mono truncate">
                        {scene.id.slice(0, 22)}…
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cloud !== undefined && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              cloud < 10
                                ? "bg-[#3ecf8e]/20 text-[var(--accent-green)]"
                                : "bg-accent-blue/20 text-accent-blue"
                            }`}
                          >
                            ☁ {cloud.toFixed(0)}%
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-green/20 text-accent-green">
                          10m
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      {formatSceneDate(scene.properties.datetime)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
