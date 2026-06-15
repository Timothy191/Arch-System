# Product Overview

**Arch-Systems (Plantcor)** is a multi-departmental mining operations portal. It provides authenticated, role-scoped access to department-specific dashboards for:

- Drilling, Production, Access Control, Engineering, Control Room, Safety, Training, Satellite Monitoring

Each department has its own tabs, data entry forms, and Supabase RLS-scoped queries. The portal is the primary app; an overview dashboard and a headless CMS are secondary apps in the same monorepo.

## Key Capabilities

- Department dashboards with KPIs, daily logs, machine tracking, and shift-based data entry
- Role-based access control (admin, supervisor, operator) enforced at the database level via RLS
- Embedded third-party tools (n8n, Flowise) surfaced through a tools page per department
- AI chat endpoint with multi-provider failover (Groq → OpenRouter → Together)
- Satellite/GIS views using MapLibre + deck.gl
- 3D visualizations via React Three Fiber
- Spreadsheet embedding via Univer SDK
