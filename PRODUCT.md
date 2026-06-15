# PRODUCT.md

## Related Documentation

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index and quick navigation guide
- **[DESIGN.md](DESIGN.md)** — Design system, color palette, and component rules
- **[CLAUDE.md](CLAUDE.md)** — Technical implementation and architecture
- **[AGENTS.md](AGENTS.md)** — Development workflow and quality gates

---

## Product

Arch-Systems (Plantcor) Mining Operations Portal. Multi-departmental dashboard and data-entry system for surface mining operations. Authenticated access to department-specific tools for drilling, production, access control, engineering, control room, safety, training, and satellite monitoring.

## Users

1. **Control Room Operators** (primary). 24/7 shift work. Need at-a-glance machine status, hourly load grids, real-time alerts. Low tolerance for navigation friction; every click costs seconds during active operations.
2. **Engineering Staff**. Review breakdowns, log notes, analyze equipment performance. Need dense data tables, historical trends, form-based data entry.
3. **Safety Officers**. Incident reporting, compliance documentation. Need clear forms, signature capture, straightforward workflows.
4. **Satellite Monitoring Analysts**. GIS maps, SAR/InSAR data, scene catalogs. Need large visual surfaces, map interactions, time-series overlays.
5. **Department Supervisors / Management**. Cross-department visibility. Need summary KPIs, report generation, high-level status.

## Tone

Direct, industrial, functional. No marketing fluff. Labels are terse ("Hourly Loads", not "Manage Your Hourly Load Data"). Error messages say what happened and what to do. The UI should feel like a professional tool, not a consumer app.

## Anti-References (what we are NOT)

- Not a SaaS landing page. No hero metrics, no big-number-and-label cards, no gradient-accented stats.
- Not a consumer social app. No playful illustrations, no emoji, no gamification.
- Not a generic admin dashboard template. No identical card grids with icon + heading + text repeated endlessly.
- Not a terminal-native dark mode. We are not chasing the "engineering tool" aesthetic reflex of pure green-on-black or monospace-everything.
- Not glassmorphism-heavy. Glass cards are not the default; use only where they genuinely improve hierarchy.
- Dark mode does not exist. The product is macOS Sonoma-inspired: light-only, white/glass surfaces, soft shadows.

## Strategy

- **Register**: product (design serves the product; this is a tool, not a brand experience).
- **Color strategy**: Restrained. Tinted neutrals + one functional accent ≤10%. macOS Sonoma-inspired light palette. Glass cards with white/70 backdrop, backdrop-blur, and delicate borders use the `shadow-window` / `shadow-card` / `shadow-diffusion-*` token suite. Mining is dirty, physical, heavy; the UI should feel clean and calm by contrast.
- **Theme**: Light-only. No dark mode. Scene: a manager reviews daily operations at a standing desk in a bright field office mid-morning. Sunlight through windows, whiteboard on the wall, tablets and monitors showing real-time pit data. The screen must be legible in all ambient lighting conditions — direct sun, overcast, and twilight. Mood: operational clarity.
- **Information density**: High. Tables, grids, forms, and maps dominate. White space is a luxury we use sparingly and deliberately.
- **Interaction model**: Tab-based department navigation. Sidebar for sub-tabs. Most actions are inline or form-based; modals are a last resort.
- **Motion**: Minimal, purposeful. Transitions that orient the user (page changes, tab switches), not decoration. No bounce, no elastic.

## Surface Mapping

| Surface               | Register | Notes                                                                                          |
| --------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| Login page            | product  | Functional light-mode blueprint video background, glassmorphic login card. No brand posturing. |
| Hub (department grid) | product  | Navigation surface. Dense grid, clear status indicators.                                       |
| Department dashboards | product  | KPIs + live data + tables. Highest information density.                                        |
| Data entry forms      | product  | Form state machine (idle/submitting/success/error). Inline validation.                         |
| Maps (satellite)      | product  | Full-bleed map surfaces, overlay panels for controls.                                          |
| Admin panel           | product  | Table-heavy management UI.                                                                     |
| AI chat               | product  | Embedded assistant, streaming responses, code highlighting.                                    |
