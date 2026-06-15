"use client";

import Image from "next/image";
import { useState } from "react";
import type { STACItem } from "@/lib/monitoring-api";
import { formatSceneDate, getSTACQuicklookUrl } from "@/lib/monitoring-api";

export type SpectralComposite = "truecolor" | "falsecolor" | "ndvi" | "geology";

interface HyperspectralLayerProps {
  scenes: STACItem[];
  activeComposite: SpectralComposite;
  onCompositeChange: (_composite: SpectralComposite) => void;
}

const COMPOSITES: {
  id: SpectralComposite;
  label: string;
  description: string;
  bands: string;
  resolution: string;
  use: string;
  color: string;
}[] = [
  {
    id: "truecolor",
    label: "True Color",
    description: "Natural RGB composite",
    bands: "B04, B03, B02",
    resolution: "10m",
    use: "Visual site overview, equipment position verification",
    color: "sky",
  },
  {
    id: "falsecolor",
    label: "False Color (NIR)",
    description: "NIR-Red-Green — vegetation appears red",
    bands: "B08, B04, B03",
    resolution: "10m",
    use: "Vegetation health, revegetation progress monitoring",
    color: "emerald",
  },
  {
    id: "ndvi",
    label: "NDVI",
    description: "Normalised Difference Vegetation Index",
    bands: "(B08−B04)/(B08+B04)",
    resolution: "10m",
    use: "Dust suppression effectiveness, reclamation compliance",
    color: "lime",
  },
  {
    id: "geology",
    label: "SWIR Geology",
    description: "SWIR-NIR-Blue mineral composite",
    bands: "B12, B08, B02",
    resolution: "20m",
    use: "Mineral outcrop mapping, AMD plume detection",
    color: "violet",
  },
];

const COMPOSITE_COLORS: Record<SpectralComposite, string> = {
  truecolor: "sky",
  falsecolor: "emerald",
  ndvi: "lime",
  geology: "violet",
};

const MINERAL_SIGNATURES = [
  {
    mineral: "Iron Oxide / Gossan",
    color: "#ef4444",
    bands: "B04/B02 > 2.0",
    concern: "AMD precursor, acid generating waste",
    risk: "high",
  },
  {
    mineral: "Jarosite",
    color: "#1c1c1e",
    bands: "B11/B12 ratio",
    concern: "Active sulfide oxidation zone",
    risk: "high",
  },
  {
    mineral: "Kaolinite / Clay",
    color: "#27272a",
    bands: "B12/B11 ratio",
    concern: "Tailings mineralogy, slimes dam stability",
    risk: "medium",
  },
  {
    mineral: "Carbonate",
    color: "#3f3f46",
    bands: "B11 absorption",
    concern: "Neutralisation potential — positive indicator",
    risk: "low",
  },
  {
    mineral: "Sulfide Exposure",
    color: "#52525b",
    bands: "B12 dark absorption",
    concern: "Direct AMD risk — needs encapsulation",
    risk: "high",
  },
  {
    mineral: "Chlorophyll / Algae",
    color: "#3ecf8e",
    bands: "B08 high reflectance",
    concern: "Water body eutrophication from AMD leachate",
    risk: "medium",
  },
];

const RISK_COLORS: Record<string, string> = {
  high: "text-accent-red",
  medium: "text-accent-blue",
  low: "text-accent-green",
};

function sceneAgeDays(datetime: string): number {
  return Math.floor((Date.now() - new Date(datetime).getTime()) / 86400000);
}

function getActiveClass(composite: SpectralComposite, color: string) {
  const map: Record<string, string> = {
    sky: "bg-sky-500/10 border-sky-500/40",
    emerald: "bg-accent-green/10 border-accent-green/40",
    lime: "bg-lime-500/10 border-lime-500/40",
    violet: "bg-violet-500/10 border-violet-500/40",
  };
  return map[color] ?? "bg-[#3ecf8e]/10 border-[#3ecf8e]/40";
}

function getActiveLabelClass(composite: SpectralComposite, color: string) {
  const map: Record<string, string> = {
    sky: "text-sky-400",
    emerald: "text-accent-green",
    lime: "text-lime-400",
    violet: "text-violet-400",
  };
  return map[color] ?? "text-[#3ecf8e]";
}

export function HyperspectralLayer({
  scenes,
  activeComposite,
  onCompositeChange,
}: HyperspectralLayerProps) {
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
        <div className="flex items-start gap-3">
          <span className="text-violet-400 text-xl mt-0.5">🌈</span>
          <div>
            <p className="text-sm font-semibold text-violet-400">
              Sentinel-2 Multispectral — 13 Bands
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              Sentinel-2 MSI captures 13 spectral bands from 443 nm (coastal) to
              2190 nm (SWIR2) at 10–60 m resolution, 5-day global revisit. Band
              combinations reveal mineral composition, vegetation health, and
              water quality — critical for AMD detection and reclamation
              compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Composite Selector */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Band Composite
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COMPOSITES.map((comp) => {
            const isActive = activeComposite === comp.id;
            const color = COMPOSITE_COLORS[comp.id];
            return (
              <button
                key={comp.id}
                onClick={() => onCompositeChange(comp.id)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  isActive
                    ? getActiveClass(comp.id, color)
                    : "bg-[var(--bg-primary)] border-[var(--border-emphasis)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p
                    className={`text-sm font-medium ${
                      isActive
                        ? getActiveLabelClass(comp.id, color)
                        : "text-[var(--text-heading)]"
                    }`}
                  >
                    {comp.label}
                  </p>
                  <span className="text-[9px] text-[var(--text-secondary)] font-mono">
                    {comp.resolution}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                  {comp.bands}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug">
                  {comp.use}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* AMD Risk Panel */}
      <div className="p-4 rounded-xl bg-accent-red/5 border border-accent-red/20">
        <p className="text-xs font-semibold text-accent-red uppercase tracking-wider mb-1">
          AMD Risk — Spectral Indicators
        </p>
        <p className="text-[10px] text-[var(--text-secondary)] mb-3">
          Acid Mine Drainage precursors detectable in Sentinel-2 SWIR bands. Use
          SWIR Geology composite to identify high-risk zones.
        </p>
        <div className="space-y-2.5">
          {MINERAL_SIGNATURES.map((sig) => (
            <div key={sig.mineral} className="flex items-start gap-3">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5"
                style={{ background: sig.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-[var(--text-heading)]">
                    {sig.mineral}
                  </p>
                  <span
                    className={`text-[9px] font-medium uppercase ${RISK_COLORS[sig.risk]}`}
                  >
                    {sig.risk}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                  {sig.concern}
                </p>
                <p className="text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">
                  {sig.bands}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scene List */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Available Sentinel-2 Scenes
        </p>
        {scenes.length === 0 ? (
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-center">
            <p className="text-[var(--text-secondary)] text-sm">
              No cloud-free scenes in range
            </p>
            <p className="text-[var(--text-secondary)] text-xs mt-1">
              Copernicus STAC query returned 0 results — expand time window or
              cloud cover threshold
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {scenes.slice(0, 6).map((scene) => {
              const cloud = scene.properties["eo:cloud_cover"];
              const ageDays = sceneAgeDays(scene.properties.datetime);
              const quicklook = getSTACQuicklookUrl(scene);
              const isExpanded = expandedScene === scene.id;

              return (
                <div
                  key={scene.id}
                  className="rounded-xl border bg-[var(--bg-primary)] border-[var(--border-emphasis)] overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedScene(isExpanded ? null : scene.id)
                    }
                    className="w-full text-left p-3 hover:bg-[#1e1e1e] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[var(--text-heading)] font-medium font-mono truncate max-w-[150px]">
                        {scene.id.slice(0, 20)}…
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cloud !== undefined && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              cloud < 10
                                ? "bg-[#3ecf8e]/20 text-[#3ecf8e]"
                                : cloud < 25
                                  ? "bg-accent-blue/20 text-accent-blue"
                                  : "bg-accent-red/20 text-accent-red"
                            }`}
                          >
                            ☁ {cloud.toFixed(0)}%
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                          S2
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-secondary)]">
                      <span>{formatSceneDate(scene.properties.datetime)}</span>
                      <span
                        className={
                          ageDays > 14 ? "text-accent-blue" : "text-[#3ecf8e]"
                        }
                      >
                        {ageDays}d ago
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-[var(--border-default)]">
                      {quicklook && (
                        <Image
                          src={quicklook}
                          alt="Scene quicklook preview"
                          className="w-full h-24 object-cover rounded-lg mt-2 mb-2"
                          loading="lazy"
                          width={320}
                          height={96}
                          unoptimized
                        />
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        {scene.properties["s2:mgrs_tile"] && (
                          <>
                            <span className="text-[var(--text-secondary)]">
                              MGRS Tile
                            </span>
                            <span className="text-[var(--text-heading)] font-mono">
                              {scene.properties["s2:mgrs_tile"]}
                            </span>
                          </>
                        )}
                        <span className="text-[var(--text-secondary)]">
                          Platform
                        </span>
                        <span className="text-[var(--text-heading)]">
                          {scene.properties.platform ?? "Sentinel-2"}
                        </span>
                        {cloud !== undefined && (
                          <>
                            <span className="text-[var(--text-secondary)]">
                              Cloud cover
                            </span>
                            <span className="text-[var(--text-heading)]">
                              {cloud.toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
