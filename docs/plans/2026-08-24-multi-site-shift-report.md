---
title: "Multi-Site Control Room & Engineering Shift Report"
date: "2026-08-24"
status: "ready"
artifact_contract: "ce-unified-plan/v1"
artifact_readiness: "implementation-ready"
product_contract_source: "ce-plan-bootstrap"
---

# Multi-Site Control Room & Engineering Shift Report

## Product Contract

### Summary

Implement an end-to-end multi-site operational and engineering shift reporting engine that unifies excavator-truck hauling tallies, bulldozer rollover volumes, ancillary service runs, and equipment availability registers across Brakfontein Pit (BKF), Extension Pit (EXT), Coal Processing Plant (PLANT), and Bredell Off-Site Workshop. The system provides high-density web reporting, standard A4 print stylesheet formatting, and cryptographic digital sign-off with PDF export.

### Problem Frame

Currently, operational shift logs and machine telemetry are partially decentralized across separate domain tables without multi-site assignment metadata or standardized compilation for cross-pit operations. Control room supervisors and engineering leads require a unified shift summary matching official mine compliance sheets (Brakfontein, Extension, Processing Plant, and Bredell Workshop) that can calculate BCM, tonnage rates, dozer rollover volume factors, and generate cryptographically sealed shift audit PDFs.

### Requirements

- **R1 (Multi-Site Operational Schema)**: Extend database schema with migration `0148_multi_site_production_report.sql` to introduce `machine_operational_status` enum, enhanced `machine_operations` fields, `excavator_haul_logs`, `excavator_truck_tallies`, `dozer_rollover_logs`, and `ancillary_shift_logs`.
- **R2 (PostgreSQL Aggregation RPC)**: Deploy `get_multi_site_shift_compilation(p_department_id, p_shift_date, p_shift_type)` returning structured JSONB with partitioned production, rollover, fleet SMU status, ancillary runs, and breakdowns by site.
- **R3 (Shared Contracts & Types)**: Add Zod schemas and TypeScript type exports in `@repo/contract` (`packages/contract/src/schemas/multi-site-production.schema.ts` and types re-exported via index).
- **R4 (Multi-Site Dashboard View)**: Create `MultiSiteShiftReportClient.tsx` in `@repo/departments/ui` with site segment filtering (`ALL`, `BKF`, `EXT`, `PLANT`), performance metric cards, rollover logs, downtime tables, and Bredell off-site tracking.
- **R5 (Print Stylesheet & High-Density PDF Layout)**: Implement `apps/portal/styles/print-report.css` and standalone HTML print builder with exact A4 print rules, page break controls, zero chrome, and compliance verification watermark.
- **R6 (Cryptographic Digital Sign-Off & PDF Export)**: Implement `exportSignedShiftReportPdf` Server Action with HMAC-SHA256 verification hash over report metrics and browser/PDF export trigger button `ExportPdfButton.tsx`.
- **R7 (Quality Gate & Parity)**: Maintain full compatibility with monorepo quality standards (`pnpm type-check`, `pnpm test`, `pnpm lint:styles`, `pnpm quality`).

### Scope Boundaries

- **In Scope**: Database migrations, RPC aggregation functions, shared contract schemas, UI dashboard components, print stylesheet, cryptographic sign-off Server Action, client PDF download component, and unit/integration tests.
- **Out of Scope**: Direct SCADA hardware driver reprogramming; modifying historical closed shift records prior to migration 0147.
- **Deferred to Follow-Up Work**: Automated batch email dispatch of PDF reports to mine inspectors at shift closeout.

### Success Criteria

- Schema migration applies cleanly to Supabase without breaking existing foreign key constraints.
- `get_multi_site_shift_compilation` returns full JSONB compilation matching `multiSiteShiftReportSchema`.
- UI correctly partitions excavator loads, tonnages, and rates across BKF and EXT sites with live tab switching.
- Dozer rollover correctly applies the 250 m³/h push factor against calculated SMU delta hours.
- PDF generation / Print preview renders on A4 without page overflows or table splits.
- All workspace lint, type-check, and test checks pass.

---

## Planning Contract

### Key Technical Decisions

- **Decision 1 (Generated Columns for Rollover Calculation)**: `dozer_rollover_logs` uses `GENERATED ALWAYS AS ((end_smu - start_smu) * push_factor_bcm_per_hour) STORED` for data integrity at the database layer.
- **Decision 2 (Pure Print CSS + Standalone HTML Generation)**: Provide dual-mode print/export capability: (a) native browser printing using `@media print` in `print-report.css`, and (b) server-side headless rendering via `exportSignedShiftReportPdf` with HMAC seal.
- **Decision 3 (Tree-Shakeable Contract Structure)**: Place schemas in `packages/contract/src/schemas/multi-site-production.schema.ts` and types in `packages/contract/src/types/multi-site-production.types.ts` with clean barrel exports to prevent monorepo bundle bloat.
- **Decision 4 (HMAC Digital Seal)**: Create a SHA256 cryptographic verification digest combining department ID, date, shift, production metrics, user ID, and timestamp to prevent post-close tampering.

### Dependencies

- `@repo/database`: Migration execution & RLS policies
- `@repo/contract`: Zod schemas and inferred TypeScript interfaces
- `@repo/departments/ui`: Client dashboard cards and export buttons
- `apps/portal`: Server Actions, print stylesheet, and route wiring

### Risk Analysis

- **Chromium runtime in headless CI/Serverless**: Fallback gracefully to HTML print stream or native `@react-pdf/renderer` if Chrome binary is unavailable in local sandbox.
- **Foreign key cascades**: All newly added tables reference `departments(id)` and `machines(id)` with `ON DELETE CASCADE` or `ON DELETE SET NULL` to preserve referential integrity.

---

## Implementation Units

### U1: Database Schema Migration & Aggregation RPC

- **Files**: `packages/database/migrations/0148_multi_site_production_report.sql`
- **Intent**: Deploy tables `excavator_haul_logs`, `excavator_truck_tallies`, `dozer_rollover_logs`, `ancillary_shift_logs`, update `machine_operations` and `breakdowns` with site codes and operational statuses, and create `get_multi_site_shift_compilation` RPC function.
- **Dependencies**: None (builds on 0147)
- **Test Scenarios**:
  - Run `supabase migration up` and verify tables and RPC creation.
  - Test `get_multi_site_shift_compilation` returns valid JSON structure for today's shift.

### U2: Shared Contracts & Type Definitions

- **Files**:
  - `packages/contract/src/schemas/multi-site-production.schema.ts`
  - `packages/contract/src/types/multi-site-production.types.ts`
  - `packages/contract/src/index.ts`
- **Intent**: Define `multiSiteShiftReportSchema`, `operationalStatusEnum`, `excavatorHaulSchema`, and inferred types.
- **Dependencies**: U1
- **Test Scenarios**:
  - Add unit test verifying parsing of a complete multi-site shift report payload.
  - Build package via `pnpm --filter @repo/contract build`.

### U3: Print Stylesheet & PDF Export Server Action

- **Files**:
  - `apps/portal/styles/print-report.css`
  - `apps/portal/app/(departments)/[department]/shift-compilation/pdf-actions.ts`
- **Intent**: Provide A4 print rules and `exportSignedShiftReportPdf` Server Action calculating HMAC cryptographic signatures.
- **Dependencies**: U2
- **Test Scenarios**:
  - Unit test HMAC signature hash calculation and payload builder.
  - Verify CSS rules under `@media print` with `pnpm lint:styles`.

### U4: UI Dashboard & Client Components

- **Files**:
  - `libs/features/departments/ui/src/control-room/MultiSiteShiftReportClient.tsx`
  - `libs/features/departments/ui/src/control-room/ExportPdfButton.tsx`
  - `libs/features/departments/ui/src/index.ts`
  - `apps/portal/app/(departments)/[department]/shift-compilation/page.tsx`
- **Intent**: Render multi-site shift cards (BKF, EXT, PLANT, BREDELL), dozer rollover progress, breakdown logs, and export buttons.
- **Dependencies**: U2, U3
- **Test Scenarios**:
  - Render test for `MultiSiteShiftReportClient` filtering between `ALL`, `BKF`, and `EXT`.
  - Verify `ExportPdfButton` loading and click handling states.

### U5: Verification & Quality Gate

- **Files**: Monorepo wide
- **Intent**: Run type-checking, Jest tests, Stylelint, and full quality checks.
- **Dependencies**: U1, U2, U3, U4
- **Test Scenarios**:
  - `pnpm type-check`
  - `pnpm test`
  - `pnpm lint:styles`
  - `pnpm quality`
