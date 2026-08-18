# Agent Tracer - Overview App

## 2026-08-18 - Direct Server Actions -> Supabase RLS Zero-Proxy Documentation

- **Purpose**: Document the direct Server Actions $\rightarrow$ Supabase RLS flow in the Backend Connections React Flow canvas, highlighting zero-middleman latency and strict Zod runtime validation.
- **Changes**:
  - `lib/data.ts`: updated `server-actions` service specs (direct session claims, strict Zod validation) and `conn-actions-db` connection specs (`Server RPC ──► Postgres / RLS`).
  - `app/sections/BackendArchitecture.tsx`: added dedicated visual architecture callout banner in the inspector drawer when `server-actions` or `supabase-db` is selected, emphasizing the zero-middleman proxy benefits over classical NestJS architectures.
- **Verification**: Ran `pnpm --filter arch-systems-overview type-check`, `lint`, and verified dev server at `http://localhost:3002`.

## 2026-08-18 - SCADA Live Telemetry Tags & OPC-UA/Modbus Inspector Stream

- **Purpose**: Add simulated real-time SCADA telemetry tags (OPC-UA polling rates, Modbus register counts, live tag matrix with jitter) to the SCADA node inspector in the React Flow Backend Connections canvas.
- **Changes**:
  - `lib/data.ts`: added `ScadaTelemetryTag` and `ScadaMetrics` interfaces, enriched `fuxa-scada` with 10Hz OPC-UA polling, 1,284 Modbus holding registers across 16 PLC drops, 42.8 KB/s throughput, and 8 heavy machinery telemetry tags (excavator payload, hydraulic pressure, drill penetration rate, hole depth, truck incline grade, conveyor belt speed & bearing temperature, substation bus voltage).
  - `app/sections/BackendArchitecture.tsx`: integrated `ScadaTelemetryInspector` with live heartbeat streaming status, live numeric jitter simulation hook (1.4s cycle), protocol filter pills (`All`, `OPC-UA`, `Modbus-TCP`), tag search input, and animated live value badges. Also added live SCADA status badge to `ServiceNode` on the visual canvas.
- **Verification**: Ran `pnpm --filter arch-systems-overview type-check`, `lint`, and `build` (100% pass), launched dev server on port 3002 (`http://localhost:3002`).
- **Next Steps**: Test interactive node inspector and flow filtering live in browser at `http://localhost:3002`.

## 2026-08-18 - Backend Architecture & Connections Flow Diagram Addition

- **Purpose**: Implement interactive Backend Connections flow diagram (`BackendArchitecture.tsx`) in `apps/overview` using `@xyflow/react`.
- **Changes**:
  - `lib/data.ts`: added `BACKEND_SERVICES` (12 services) and `BACKEND_CONNECTIONS` (12 flow edges) with rich protocols, security, SLAs, and features.
  - `app/sections/BackendArchitecture.tsx`: built full interactive React Flow canvas with custom nodes, animated edges, topology layers legend, connection filter modes (All Mesh, Core Data, Fast Cache, SCADA/Realtime, AI/OTel), and selected node/edge inspector drawer.
  - `app/page.tsx`: registered `Backend Connections` (`backend`) tab with lazy-loaded section loader.
- **Verification**: `pnpm --filter arch-systems-overview type-check`, `lint`, and `build` passed cleanly with 100% static compilation.
- **Next Steps**: View the interactive diagram locally with `pnpm --filter arch-systems-overview dev` on port 3002.

## 2026-06-25 - Phase 3 token compliance for overview shell

- **Purpose**: Replace hardcoded overview body background with design token per Phase 3 token integration step.
- **Changes**:
  - `app/layout.tsx`: `bg-[#0f0f0f]` → `bg-[var(--arch11)]` (dark canvas token from `@repo/theme`).
- **Next Steps**: Verify overview dev server (:3002) — React Flow nodes/edges and dark canvas background.

## 2026-06-24 - Explicit CSS layer order and React Flow layering

- **Purpose**: Align overview CSS cascade with `@repo/ui` — explicit layer declaration and component-layer grouping for XYFlow styles.
- **Changes**:
  - `app/globals.css`: Added `@layer reset, base, theme, components, utilities;` after theme import.
  - Wrapped all `.react-flow*` and tab active-state rules inside `@layer components`.
- **Next Steps**: Verify React Flow node/edge styling in overview dev server (`pnpm --filter overview dev` on :3002).
