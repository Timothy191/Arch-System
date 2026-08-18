"use client";

import NextImage from "next/image";
import { useState, useMemo } from "react";
import type { STACItem } from "@repo/shared/data-access";
import { formatSceneDate, getSTACQuicklookUrl } from "@repo/shared/data-access";

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
  const [selectedScene, setSelectedScene] = useState<string | null>(scenes[0]?.id ?? null);

  const [baseElev, setBaseElev] = useState<string>("1250");
  const [peakElev, setPeakElev] = useState<string>("1278");
  const [areaHa, setAreaHa] = useState<string>("2.4");
  const [material, setMaterial] = useState<string>("Ore (mixed)");

  const [cdFrom, setCdFrom] = useState<string>("");
  const [cdTo, setCdTo] = useState<string>("");

  // Interactive Viewport & Spectral Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [spectralBand, setSpectralBand] = useState<"rgb" | "nir" | "ndvi" | "sar">("rgb");
  const [maxCloudFilter, setMaxCloudFilter] = useState<number>(100);

  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const cloud = scene.properties["eo:cloud_cover"];
      if (cloud === undefined) return true;
      return cloud <= maxCloudFilter;
    });
  }, [scenes, maxCloudFilter]);

  const activeSceneObj = useMemo(() => {
    return scenes.find((s) => s.id === selectedScene) || filteredScenes[0] || null;
  }, [scenes, filteredScenes, selectedScene]);

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
              High-Resolution Commercial Imagery & Multi-Spectral Analytics
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              Sub-metre constellations (Planet Labs, Maxar, Airbus) image the pit daily at 0.3–3 m.
              DEM differencing between acquisition dates calculates excavation volumes and stockpile
              tonnage without ground survey. Sentinel-2 (10 m, free) provides baseline calibration.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive High-Res Scene Viewport */}
      {activeSceneObj && (
        <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--text-heading)] font-mono">
                {activeSceneObj.id}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Acquired: {formatSceneDate(activeSceneObj.properties.datetime)} | Cloud:{" "}
                {activeSceneObj.properties["eo:cloud_cover"] !== undefined
                  ? `${activeSceneObj.properties["eo:cloud_cover"].toFixed(0)}%`
                  : "N/A"}
              </p>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border-default)]">
              <span className="text-[10px] text-[var(--text-muted)] px-1.5 font-medium">Zoom:</span>
              {[1, 2, 3, 4].map((z) => (
                <button
                  key={z}
                  onClick={() => setZoomLevel(z)}
                  className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                    zoomLevel === z
                      ? "bg-[var(--accent-blue)] text-white"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  }`}
                >
                  {z}x
                </button>
              ))}
              <button
                onClick={() => setZoomLevel(1)}
                className="text-[10px] px-1.5 py-0.5 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                title="Reset zoom"
              >
                ↺
              </button>
            </div>
          </div>

          {/* Spectral Band Presets */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[var(--border-emphasis)]">
            <span className="text-[10px] text-[var(--text-muted)] font-medium">Spectral Band:</span>
            {(
              [
                { id: "rgb", label: "True Color (RGB)" },
                { id: "nir", label: "False Color (NIR/Vegetation)" },
                { id: "ndvi", label: "Moisture Index (NDWI)" },
                { id: "sar", label: "SAR Coherence" },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                onClick={() => setSpectralBand(b.id)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  spectralBand === b.id
                    ? "bg-accent-green/20 border-accent-green text-accent-green font-medium"
                    : "border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Imagery Canvas / Viewport */}
          <div className="relative w-full h-64 rounded-lg overflow-hidden bg-black/90 border border-[var(--border-default)] flex items-center justify-center">
            {getSTACQuicklookUrl(activeSceneObj) ? (
              <div
                className="w-full h-full relative transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${zoomLevel})`,
                  filter:
                    spectralBand === "nir"
                      ? "contrast(1.3) hue-rotate(90deg) saturate(1.8)"
                      : spectralBand === "ndvi"
                        ? "contrast(1.5) saturate(2) hue-rotate(180deg)"
                        : spectralBand === "sar"
                          ? "grayscale(1) contrast(1.8)"
                          : "none",
                }}
              >
                <NextImage
                  src={getSTACQuicklookUrl(activeSceneObj)!}
                  alt="High-resolution satellite inspection canvas"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="text-center p-4">
                <span className="text-2xl">🛰️</span>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Raster quicklook stream rendering in {spectralBand.toUpperCase()} mode (
                  {zoomLevel}x zoom)
                </p>
              </div>
            )}

            {/* Viewport Overlay HUD */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-[9px] font-mono text-white/90 border border-white/10 flex items-center gap-2">
              <span>GSD: 0.5m/px</span>
              <span>•</span>
              <span>BAND: {spectralBand.toUpperCase()}</span>
              <span>•</span>
              <span>ZOOM: {zoomLevel * 100}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Stockpile Volume Estimator */}
      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Stockpile Volume Estimator
        </p>
        <p className="text-[10px] text-[var(--text-secondary)] mb-3">
          Conical approximation from DEM-derived base + peak elevation and mapped area. For
          certified survey use LiDAR or photogrammetric point cloud.
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
              <p className="text-[10px] text-[var(--text-secondary)]">Volume (m³)</p>
              <p className="text-lg font-bold text-[var(--accent-green)]">
                {stockpileResult.volumeM3.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 bg-[var(--bg-primary)] rounded-lg">
              <p className="text-[10px] text-[var(--text-secondary)]">Tonnage (t)</p>
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
          Select two dates to compare imagery and detect stockpile movement, new infrastructure, or
          tailings pond level changes.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">From date</label>
            <input
              type="date"
              value={cdFrom}
              onChange={(e) => setCdFrom(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">To date</label>
            <input
              type="date"
              value={cdTo}
              onChange={(e) => setCdTo(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
        </div>
        {cdFrom && cdTo && (
          <div className="p-2.5 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-emphasis)]">
            <p className="text-[10px] text-accent-green font-medium">
              Comparing {cdFrom} → {cdTo}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              Differential raster analysis queued for next imagery sync cycle.
            </p>
          </div>
        )}
      </div>

      {/* Mining Industry Use Cases */}
      <div>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Mining High-Res Use Cases
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {USE_CASES.map((uc) => (
            <div
              key={uc.title}
              className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{uc.icon}</span>
                <p className="text-xs font-semibold text-[var(--text-heading)]">{uc.title}</p>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                {uc.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Commercial Provider Comparison */}
      <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Satellite Constellation Comparison
        </p>
        <p className="text-[10px] text-[var(--text-secondary)] mb-3">
          Overview of imagery resolutions, revisit frequencies, and commercial access options.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-emphasis)]">
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
                  Resolution
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
                  <td className="p-2.5 text-[var(--text-muted)] text-[11px]">{p.resolution}</td>
                  <td className="p-2.5 text-[var(--text-muted)] text-[11px]">{p.revisit}</td>
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

      {/* Latest scenes with Cloud Filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Available STAC Scenes ({filteredScenes.length})
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="cloud-filter" className="text-[10px] text-[var(--text-muted)]">
              Max Cloud: {maxCloudFilter}%
            </label>
            <input
              id="cloud-filter"
              type="range"
              min="0"
              max="100"
              step="5"
              value={maxCloudFilter}
              onChange={(e) => setMaxCloudFilter(Number(e.target.value))}
              className="w-20 accent-accent-green h-1.5 bg-[var(--bg-secondary)] rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {filteredScenes.length === 0 ? (
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-center">
            <p className="text-[var(--text-secondary)] text-sm">
              No scenes match cloud filter (≤{maxCloudFilter}%)
            </p>
            <button
              onClick={() => setMaxCloudFilter(100)}
              className="text-xs text-[var(--accent-blue)] hover:underline mt-1"
            >
              Reset cloud filter
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredScenes.slice(0, 4).map((scene) => {
              const cloud = scene.properties["eo:cloud_cover"];
              const quicklook = getSTACQuicklookUrl(scene);
              return (
                <button
                  key={scene.id}
                  onClick={() => setSelectedScene(scene.id === selectedScene ? null : scene.id)}
                  className={`w-full text-left rounded-xl border transition-colors overflow-hidden ${
                    selectedScene === scene.id
                      ? "bg-accent-green/10 border-accent-green/30"
                      : "bg-[var(--bg-primary)] border-[var(--border-emphasis)] hover:bg-[var(--bg-tertiary)]"
                  }`}
                >
                  {quicklook && selectedScene === scene.id && (
                    <NextImage
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
