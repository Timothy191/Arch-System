---
title: Map/GIS Library Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [gis, visualization, decision]
sources:
  [apps/portal/package.json, CLAUDE.md, apps/portal/lib/monitoring-api.ts]
confidence: high
---

# Map/GIS Library Comparison: react-map-gl + MapLibre vs Google Maps vs Leaflet

## What is Being Compared

Selection of mapping library stack for satellite monitoring (SAR/InSAR), site visualization, and equipment tracking in the mining operations portal.

## Dimensions of Comparison

| Dimension             | react-map-gl + MapLibre              | Google Maps React                     | Leaflet                    |
| --------------------- | ------------------------------------ | ------------------------------------- | -------------------------- |
| **Base Engine**       | MapLibre GL JS (open source)         | Google Maps Platform                  | Leaflet (open source)      |
| **License**           | BSD / MIT                            | Paid (API key required, usage limits) | BSD                        |
| **Vector Tiles**      | Native                               | Native                                | Plugin (Mapbox GL Leaflet) |
| **WebGL Rendering**   | Yes                                  | Yes                                   | Canvas/SVG (slower)        |
| **React Integration** | Official react-map-gl                | @react-google-maps/api                | react-leaflet (community)  |
| **Custom Styling**    | Full style JSON control              | Limited (Google styles only)          | CSS-based                  |
| **Offline/On-Prem**   | Self-hosted tiles possible           | No                                    | Self-hosted tiles possible |
| **Satellite Imagery** | Via third-party (Copernicus, Planet) | Google Satellite                      | Via plugins                |
| **Bundle Size**       | Moderate (WebGL)                     | Large                                 | Small (but slower)         |
| **Performance**       | Excellent (GPU-accelerated)          | Excellent                             | Good (DOM/Canvas)          |

## Project Implementation

The portal uses **react-map-gl 8 + MapLibre GL 5** for:

- **Satellite monitoring** (`satellite-monitoring` department): SAR/InSAR deformation overlays
- **Site visualization**: Mine site boundaries, equipment locations
- **Control room**: Real-time machine positioning

```typescript
import { Map, Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

<Map
  initialViewState={{ longitude: 28.0, latitude: -26.0, zoom: 12 }}
  mapStyle="https://tiles.example.com/style.json"
>
  <Source id="deformation" type="raster" tiles={[...]}>
    <Layer id="deformation-layer" type="raster" />
  </Source>
</Map>
```

Data sources:

- Copernicus STAC API for satellite scenes
- Custom vector tiles for site boundaries
- Real-time WebSocket for machine positions

## Why MapLibre Was Chosen

1. **Open source stack** — No vendor lock-in, self-hostable tiles
2. **Vector tile performance** — GPU-accelerated rendering for smooth zoom/pan
3. **Custom styling** — Full control over map appearance (matches dark theme)
4. **Copernicus integration** — Open satellite data sources work natively
5. **Cost** — No per-map-load charges (critical for always-open control room displays)

## Why Not Google Maps

Google Maps would require:

- API key management and quota monitoring
- Costs scale with control room displays (24/7 operation)
- Limited custom styling for dark theme match
- Vendor lock-in to Google Cloud

## Why Not Leaflet

Leaflet is excellent for simple maps but:

- Canvas/SVG rendering is slower than WebGL for heavy data layers
- Vector tile support requires plugin integration
- React integration is community-maintained (react-leaflet)

For SAR/InSAR raster overlays and real-time machine tracking, WebGL performance is essential.

## Verdict

**react-map-gl + MapLibre is optimal** for open satellite data integration, cost-effective 24/7 operation, and custom dark-themed visualization.

## Related

- [[monitoring-error-tracking]] — Satellite monitoring data layer
- [[department-features]] — Satellite monitoring department tabs
