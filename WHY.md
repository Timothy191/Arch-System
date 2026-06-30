# WHY.md — Domain Authority

> Modular context root. Full product strategy: `06_technical_documentation/PRODUCT.md`.

## What we build

Arch-Systems (Plantcor) — multi-departmental **mining operations portal**. Authenticated dashboards and **manual data-entry** for drilling, production, access control, engineering, control room, safety, training, and satellite monitoring.

## Who we serve

| Persona | Need |
|---------|------|
| Control room operators | At-a-glance status, hourly grids, low-friction 24/7 UI |
| Engineering | Dense tables, breakdown notes, equipment history |
| Safety | Clear forms, signatures, compliance workflows |
| Satellite analysts | Maps, SAR/InSAR, time-series overlays |
| Supervisors | KPIs, cross-department visibility |

## Non-negotiables

1. **Manual human input first** — paper-based reporting is primary truth; sensors enrich only.
2. **Offline-first** — remote sites sync eventually; design for disconnected operation.
3. **Light macOS glass UI** — operational clarity, high density, no dark/cyber/SaaS fluff.
4. **`employees` table** is auth source of truth (not Supabase Auth metadata).

## Success looks like

Operators enter shift data quickly and accurately; supervisors trust reports; system works when connectivity is poor.
