---
title: Satellite Monitoring Department
created: 2026-05-16
updated: 2026-05-16
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Satellite Monitoring Department

The Satellite Monitoring department in Arch-Systems provides SAR/InSAR analysis, hyperspectral imaging, and high-resolution satellite imagery for mining operations. It uses specialized GIS and map visualization tools.

## Tabs

- dashboard — Satellite monitoring overview
- sar — SAR (Synthetic Aperture Radar) and InSAR (Interferometric SAR) analysis for ground deformation
- hyperspectral — Hyperspectral imagery for mineral identification and environmental monitoring
- highres — High-resolution optical imagery for site mapping and change detection

## Key Features

- **SAR/InSAR Analysis**: Ground deformation monitoring via radar interferometry
- **Hyperspectral Imaging**: Mineral identification, vegetation health, and environmental baselines
- **High-Resolution Imagery**: Sub-metre optical imagery for site planning and change detection
- **Map Integration**: Built on react-map-gl 8 + maplibre-gl 5 for open satellite data visualization
- **Scene Catalog**: Latest imagery tracking and historical archive

## Technology Stack

- **Maps**: react-map-gl + MapLibre GL (open-source, no API keys required)
- **3D Visualization**: @react-three/fiber + @react-three/drei for terrain models
- **Geospatial**: deck.gl for large-scale data overlays

## Dashboard KPIs

- **Latest Imagery**: Most recent scene acquisition date
- **Deformation Alerts**: Active InSAR displacement warnings
- **Scene Coverage**: Percentage of site covered by recent imagery
- **Processing Queue**: Scenes awaiting analysis

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting satellite data
- [[design-system]] — UI conventions used in satellite monitoring interfaces
- [[department-features]] — satellite monitoring capabilities overview
- [[monitoring-error-tracking]] — satellite monitoring API integration
