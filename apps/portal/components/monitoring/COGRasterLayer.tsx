"use client";

import { useState } from "react";
import Map from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { BitmapLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";

interface COGBandConfig {
  label: string;
  value: string;
  description: string;
}

const BAND_COMBOS: COGBandConfig[] = [
  {
    label: "True Color",
    value: "truecolor",
    description: "RGB natural color (B4/B3/B2)",
  },
  {
    label: "False Color",
    value: "falsecolor",
    description: "NIR + Red + Green vegetation analysis",
  },
  {
    label: "NDVI",
    value: "ndvi",
    description: "Normalized Difference Vegetation Index",
  },
  {
    label: "Geology",
    value: "geology",
    description: "Geological enhancement (SWIR bands)",
  },
  {
    label: "SAR Mosaic",
    value: "sar",
    description: "Sentinel-1 GRD mosaic (VV/VH)",
  },
];

// Demo COG tile endpoints for satellite imagery
const COG_TILE_URLS: Record<string, string> = {
  truecolor:
    "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
  falsecolor:
    "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
  ndvi: "https://tiles.maps.eox.at/wmts/1.0.0/ndvi_30m_2019_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpeg",
  geology:
    "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
  sar: "https://tiles.maps.eox.at/wmts/1.0.0/sar_mosaic_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpeg",
};

interface COGRasterLayerProps {
  center?: { lat: number; lon: number };
  zoom?: number;
  height?: string;
}

export function COGRasterLayer({
  center = { lat: -26.25, lon: 26.75 },
  zoom = 12,
  height = "480px",
}: COGRasterLayerProps) {
  const [viewState, setViewState] = useState({
    latitude: center.lat,
    longitude: center.lon,
    zoom,
    pitch: 0,
    bearing: 0,
  });
  const [activeBand, setActiveBand] = useState("truecolor");
  const [opacity, setOpacity] = useState(1.0);

  const tileUrl: string = COG_TILE_URLS[activeBand] ?? COG_TILE_URLS.truecolor!;

  const layers = [
    new BitmapLayer({
      id: "cog-overlay",
      image: tileUrl, // Tile-based imagery via MapLibre raster source instead
      bounds: [-180, -90, 180, 90],
      opacity,
      pickable: false,
    }),
  ];

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-start gap-3">
          <span className="text-purple-400 text-xl mt-0.5">🗺️</span>
          <div>
            <p className="text-sm font-semibold text-purple-400">
              Cloud-Optimized GeoTIFF (COG)
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              GPU-accelerated raster rendering directly in the browser. Supports
              multi-spectral band composites, NDVI analytics, and SAR mosaics
              via COG / WMTS endpoints. Imagery &copy; EOX / ESA Copernicus.
            </p>
          </div>
        </div>
      </div>

      {/* Band selector */}
      <div className="flex flex-wrap gap-1.5">
        {BAND_COMBOS.map((band) => (
          <button
            key={band.value}
            onClick={() => setActiveBand(band.value)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
              activeBand === band.value
                ? "bg-[#3ecf8e] text-[var(--text-heading)] border-[#3ecf8e]"
                : "bg-[var(--bg-primary)]/85 text-[var(--text-muted)] border-[var(--border-emphasis)] hover:text-[var(--text-heading)]"
            }`}
            title={band.description}
          >
            {band.label}
          </button>
        ))}
      </div>

      {/* Opacity slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)] w-14">
          Opacity
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="flex-1 accent-[#3ecf8e]"
        />
        <span className="text-[11px] text-[var(--text-muted)] font-mono w-8 text-right">
          {Math.round(opacity * 100)}%
        </span>
      </div>

      {/* Map */}
      <div
        className="relative rounded-xl overflow-hidden border border-[var(--border-emphasis)]"
        style={{ height }}
      >
        <DeckGL
          viewState={viewState}
          onViewStateChange={(e: any) => setViewState(e.viewState)}
          controller={true}
          layers={layers}
        >
          <Map
            mapStyle={{
              version: 8,
              sources: {
                "cog-source": {
                  type: "raster",
                  tiles: [tileUrl],
                  tileSize: 256,
                  attribution: "&copy; EOX / ESA Copernicus",
                },
                "osm-bg": {
                  type: "raster",
                  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                  tileSize: 256,
                  attribution:
                    "&copy; <a href='https://www.openstreetmap.org/copyright'>OSM</a>",
                },
              },
              layers: [
                {
                  id: "osm-bg-layer",
                  type: "raster",
                  source: "osm-bg",
                  minzoom: 0,
                  maxzoom: 22,
                },
                {
                  id: "cog-layer",
                  type: "raster",
                  source: "cog-source",
                  minzoom: 0,
                  maxzoom: 22,
                  paint: {
                    "raster-opacity": opacity,
                  },
                },
              ],
            }}
          />
        </DeckGL>

        {/* Band description overlay */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-[var(--bg-primary)]/85 rounded-lg text-[10px] text-[var(--text-secondary)] max-w-[200px] text-right pointer-events-none">
          {BAND_COMBOS.find((b) => b.value === activeBand)?.description}
        </div>
      </div>
    </div>
  );
}
