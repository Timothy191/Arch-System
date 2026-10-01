# Implementation Tasks: Access Control SOC Redesign & Competitor Standard Parity

## Phase 1: Role Resilience & Backend Actions Enhancement
- [x] **Task 1.1**: Update `assertAccessControlRole` in `apps/portal/app/(departments)/access-control/actions.ts` to provide graceful, non-crashing role resolution for view-only operations while securing write operations. (Verified: Overloaded signature and non-fatal fallback).
- [x] **Task 1.2**: Implement `getLivePerimeterGates` server action to supply live status for main booms, turnstiles, and weighbridge RFID readers. (Verified: Real-time telemetry returned).
- [x] **Task 1.3**: Implement `triggerGatePulse` server action with audit logging in `access_logs`. (Verified: Audit logging with cache invalidation).
- [x] **Task 1.4**: Implement `getMusterRollCall` and `markPersonnelMusterStatus` server actions for emergency muster reconciliation. (Verified: Multi-station accounting calculation).
- [x] **Task 1.5**: Implement `getAccessReportsData` server action for the regulatory reports suite. (Verified: Summary, taxonomy, and traffic aggregations).

## Phase 2: Security Operations Center Dashboard Components
- [x] **Task 2.1**: Build `HeadcountMusterBanner.tsx` — High-visibility command bar showing live on-site souls (Employees, Contractors, Visitors, Vehicles), blast clearance status, and quick muster trigger. (Verified: Component created and wired).
- [x] **Task 2.2**: Build `PerimeterGateHUD.tsx` — Real-time barrier telemetry card showing Gate 01 (Boom), Turnstiles 01-04 (BAC Interlock), Weighbridge 03 (RFID), and Explosives Portal with pulse actions. (Verified: Pulse trigger and status indicators working).
- [x] **Task 2.3**: Build `QuickActionHub.tsx` — Fast operational dispatch: Issue Badge, Register Visitor, Gate Pulse, Muster Station, Export Report. (Verified: Component created and wired).
- [x] **Task 2.4**: Upgrade `DashboardKPIGrid.tsx` and `DashboardActivityFeed.tsx` with competitor parity tags (Anti-Passback, BAC Fail, Expired Induction, Tailgating). (Verified: Integrated into layout).
- [x] **Task 2.5**: Redesign `apps/portal/app/(departments)/access-control/page.tsx` integrating all new SOC components into a coherent, high-density industrial layout. (Verified: Zero-waterfall RSC data fetching).

## Phase 3: Emergency Muster & Roll Call Suite (`/access-control/muster`)
- [x] **Task 3.1**: Create `apps/portal/app/(departments)/access-control/muster/page.tsx` with live on-site roster, muster point assignment, search/filter by department/zone, and emergency muster export. (Verified: Server component page active).
- [x] **Task 3.2**: Build interactive client view `MusterRollCallView.tsx` with real-time check-off toggles and safe/unaccounted counters. (Verified: Optimistic toggle and CSV export active).

## Phase 4: Regulatory Reports & Audit Studio (`/access-control/reports`)
- [x] **Task 4.1**: Create `apps/portal/app/(departments)/access-control/reports/page.tsx` resolving the legacy 404 route. (Verified: 404 resolved, page live).
- [x] **Task 4.2**: Build `AccessReportsStudio.tsx` with access volume trends, security denial taxonomy, contractor time-on-site logs, and CSV/PDF export capability. (Verified: Full studio active).

## Phase 5: Navigation & Tab Synchronization
- [x] **Task 5.1**: Update `ACCESS_CONTROL_TABS` in `libs/features/departments/data-access/src/departments.ts` to include the `muster` tab and ensure `reports` navigates seamlessly. (Verified: Synced across layouts).

## Phase 6: Quality Gate Verification & Audit
- [x] **Task 6.1**: Run `pnpm type-check` across the monorepo to guarantee 100% type safety. (Verified: 25/25 packages passed).
- [x] **Task 6.2**: Run `pnpm lint` to ensure strict Biome compliance. (Verified: 22/22 packages passed).
- [x] **Task 6.3**: Verify light-mode invariants and design token compliance. (Verified: Strict OKLCH light mode compliant).
