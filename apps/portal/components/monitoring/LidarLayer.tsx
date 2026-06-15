"use client";

import { useCallback, useRef, useState } from "react";
import Map from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { PointCloudLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";

interface LidarPoint {
  position: [number, number, number];
  color: [number, number, number];
  elevation: number;
  intensity: number;
  classification: number;
}

type ColorMode = "elevation" | "intensity" | "classification";

const CLASSIFICATION_COLORS: Record<number, [number, number, number]> = {
  1: [200, 200, 200], // Unclassified
  2: [180, 120, 60], // Ground
  3: [80, 180, 60], // Low Vegetation
  4: [60, 140, 40], // Medium Vegetation
  5: [40, 100, 20], // High Vegetation
  6: [200, 80, 80], // Building
  9: [100, 100, 200], // Water
};

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  elevation: "Elevation",
  intensity: "Intensity",
  classification: "Classification",
};

const CLASSIFICATION_LABELS: Record<number, string> = {
  1: "Unclassified",
  2: "Ground",
  3: "Low Veg",
  4: "Medium Veg",
  5: "High Veg",
  6: "Building",
  9: "Water",
};

interface LidarLayerPanelProps {
  points?: LidarPoint[];
  center?: { lat: number; lon: number };
  zoom?: number;
}

function generateDemoPoints(
  center: { lat: number; lon: number },
  count = 5000,
): LidarPoint[] {
  const points: LidarPoint[] = [];
  const baseLat = center.lat;
  const baseLon = center.lon;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.008;
    const lat = baseLat + Math.cos(angle) * radius;
    const lon = baseLon + Math.sin(angle) * radius;
    const elevation = Math.random() * 80 + 20;
    const classification = ([1, 2, 3, 4, 5, 6] as const)[
      Math.floor(Math.random() * 6)
    ]!;
    const intensity = Math.random();

    const color = CLASSIFICATION_COLORS[classification] ?? [200, 200, 200];
    const brightness = 0.6 + intensity * 0.4;

    points.push({
      position: [lon, lat, elevation],
      color: [
        Math.round(color[0] * brightness),
        Math.round(color[1] * brightness),
        Math.round(color[2] * brightness),
      ],
      elevation,
      intensity,
      classification,
    });
  }
  return points;
}

export function LidarLayerPanel({
  points,
  center = { lat: -26.25, lon: 26.75 },
  zoom = 14,
}: LidarLayerPanelProps) {
  const [viewState, setViewState] = useState({
    latitude: center.lat,
    longitude: center.lon,
    zoom: zoom,
    pitch: 60,
    bearing: 0,
  });
  const [colorMode, setColorMode] = useState<ColorMode>("classification");
  const [pointSize, setPointSize] = useState(3);

  const demoPoints = points ?? useRef(generateDemoPoints(center)).current;

  const getPointColor = useCallback(
    (d: LidarPoint) => {
      switch (colorMode) {
        case "elevation": {
          const t = Math.min(d.elevation / 100, 1);
          return [
            Math.round(60 + t * 195),
            Math.round(120 + t * 35),
            Math.round(200 - t * 150),
          ] as [number, number, number];
        }
        case "intensity": {
          const i = Math.round(d.intensity * 255);
          return [i, i, i] as [number, number, number];
        }
        case "classification":
          return d.color;
      }
    },
    [colorMode],
  );

  const layers = [
    new PointCloudLayer({
      id: "lidar-points",
      data: demoPoints,
      getPosition: (d: LidarPoint) => d.position,
      getColor: getPointColor,
      getNormal: [0, 0, 1],
      pointSize,
      sizeUnits: "pixels",
      pickable: true,
      parameters: {
        depthTest: true,
      },
      updateTriggers: {
        getColor: [colorMode],
        pointSize: [pointSize],
      },
    }),
  ];

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="p-4 rounded-xl bg-accent-green/10 border border-accent-green/20">
        <div className="flex items-start gap-3">
          <span className="text-accent-green text-xl mt-0.5">🔭</span>
          <div>
            <p className="text-sm font-semibold text-accent-green">
              LiDAR Point Cloud
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              Airborne LiDAR (ALS) point cloud showing pit topography. Colorized
              by classification: ground, vegetation, buildings. Supports COPC
              streaming for large datasets.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-secondary)]">Color:</span>
          {(Object.keys(COLOR_MODE_LABELS) as ColorMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              className={`px-2 py-1 text-[11px] rounded-lg border transition-colors ${
                colorMode === mode
                  ? "bg-[#3ecf8e] text-[var(--text-heading)] border-[#3ecf8e]"
                  : "bg-[var(--bg-primary)]/85 text-[var(--text-muted)] border-[var(--border-emphasis)] hover:text-[var(--text-heading)]"
              }`}
            >
              {COLOR_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-secondary)]">Size:</span>
          <input
            type="range"
            min={1}
            max={10}
            value={pointSize}
            onChange={(e) => setPointSize(Number(e.target.value))}
            className="w-20 accent-[#3ecf8e]"
          />
          <span className="text-[11px] text-[var(--text-muted)] font-mono w-4">
            {pointSize}
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-[var(--border-emphasis)] h-[480px]">
        <DeckGL
          viewState={viewState}
          onViewStateChange={(e: any) => setViewState(e.viewState)}
          controller={{ dragRotate: true }}
          layers={layers}
          getCursor={({ isDragging }: { isDragging?: boolean }) =>
            isDragging ? "grabbing" : "grab"
          }
        >
          <Map
            mapStyle={{
              version: 8,
              sources: {
                "osm-tiles": {
                  type: "raster",
                  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                  tileSize: 256,
                  attribution:
                    "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
                },
              },
              layers: [
                {
                  id: "osm-layer",
                  type: "raster",
                  source: "osm-tiles",
                  minzoom: 0,
                  maxzoom: 22,
                },
              ],
            }}
          />
        </DeckGL>
      </div>

      {/* Classification legend */}
      {colorMode === "classification" && (
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
          {Object.entries(CLASSIFICATION_LABELS).map(([code, label]) => {
            const color = CLASSIFICATION_COLORS[Number(code)] ?? [
              200, 200, 200,
            ];
            return (
              <div key={code} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{
                    background: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                  }}
                />
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Elevation legend */}
      {colorMode === "elevation" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)]">
          <span className="text-[10px] text-[var(--text-secondary)]">20m</span>
          <div
            className="h-3 flex-1 rounded"
            style={{
              background:
                "linear-gradient(to right, rgb(60,120,200), rgb(150,150,150), rgb(255,180,60))",
            }}
          />
          <span className="text-[10px] text-[var(--text-secondary)]">100m</span>
        </div>
      )}

      {/* Point count */}
      <p className="text-[10px] text-[var(--text-secondary)] text-right">
        {demoPoints.length.toLocaleString()} points · interactive 3D view (drag
        to rotate)
      </p>
    </div>
  );
}
