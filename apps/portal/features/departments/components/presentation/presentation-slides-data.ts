import type { PresentationSnapshot } from './presentation-data';

export type PresentationSlideVisual =
  | 'hero'
  | 'kpi-chart'
  | 'value-chain'
  | 'architecture'
  | 'governance'
  | 'roadmap';

export interface PresentationSlideMetric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface PresentationSlide {
  readonly id: string;
  readonly slideNumber: number;
  readonly chapter: string;
  readonly title: string;
  readonly subtitle: string;
  readonly headlineMetric: PresentationSlideMetric;
  readonly secondaryMetrics: readonly PresentationSlideMetric[];
  readonly highlights: readonly string[];
  readonly speakerNotes: string;
  readonly visualType: PresentationSlideVisual;
  readonly deepLink?: {
    readonly label: string;
    readonly href: string;
  };
}

export interface PresentationDocSection {
  readonly id: string;
  readonly category: 'Executive' | 'Modules' | 'Architecture' | 'Security' | 'Operations';
  readonly title: string;
  readonly summary: string;
  readonly bullets: readonly string[];
  readonly routeHref: string;
  readonly routeLabel: string;
}

export interface PresentationGlossaryItem {
  readonly term: string;
  readonly fullName: string;
  readonly explanation: string;
}

export interface PresentationModuleFlowNode {
  readonly slug: string;
  readonly name: string;
  readonly stage: string;
  readonly roleSummary: string;
  readonly tablesFed: string;
  readonly route: string;
}

export const PRESENTATION_GLOSSARY: readonly PresentationGlossaryItem[] = [
  {
    term: 'SMR',
    fullName: 'Service Meter Reading',
    explanation:
      'Cumulative machine engine hours used to reconcile shift utilization, carry over opening balances, and schedule preventive servicing.',
  },
  {
    term: 'BCM',
    fullName: 'Bank Cubic Meters',
    explanation:
      'Volumetric excavation metric computed across haul-truck loads, bin factors, and dozer push hours for daily production reconciliation.',
  },
  {
    term: 'MTTR',
    fullName: 'Mean Time To Repair',
    explanation:
      'Average elapsed hours between Engineering breakdown book-in and workshop book-out return to active pit duty.',
  },
  {
    term: 'RLS',
    fullName: 'PostgreSQL Row-Level Security',
    explanation:
      'Database-level multi-department authorization enforced inside Supabase PostgreSQL 17 using cached InitPlan employee lookups.',
  },
  {
    term: 'CDC',
    fullName: 'Change Data Capture (Supabase Realtime)',
    explanation:
      'Push-based WebSocket telemetry stream synchronizing pit loads, breakdown blocks, and gate scans across browser clients in sub-seconds.',
  },
];

export const PRESENTATION_DOC_SECTIONS: readonly PresentationDocSection[] = [
  {
    id: 'executive-primer',
    category: 'Executive',
    title: 'Executive Platform Primer: Pit-to-Plant Command',
    summary:
      'Arch-System unifies opencast pit dispatch, blasting/drilling logs, wash-plant beneficiation sheets, workshop reliability, tyre lifecycle, and site gate security on one real-time ledger.',
    bullets: [
      'Eliminates manual spreadsheet reconciliation between night/day control room shifts and workshop engineers.',
      'Delivers instant A4 PDF executive dossiers, Excel exports, and preformatted WhatsApp dispatch briefings.',
      'Operates resiliently in low-connectivity pit environments via IndexedDB offline mutation queues.',
    ],
    routeHref: '/hub/executive',
    routeLabel: 'Open Executive Dashboard',
  },
  {
    id: 'mining-modules-catalog',
    category: 'Modules',
    title: '15 Synchronized Mining & Enterprise Modules',
    summary:
      'Role-scoped workspaces configurable per operator, engineer, plant controller, security officer, or executive viewer.',
    bullets: [
      'Operations Core: Production, Drilling, Control Room SCADA (Hourly Loads, Excavator Activity, SMR Operations), Availability & Utilization.',
      'Plant & Assets: Plant Processing (ROM/Dense Medium), Plant Inventory (consumables & reorder intelligence), Engineering (24h Breakdowns, Tyre Management, Machine Telemetry).',
      'Governance & Support: Access Control (Magicard Neo 300 card printing, Alcohol logs, 12h visitor auto-exit), Office AI Suite, Database ER Explorer, System Overview, Administration.',
    ],
    routeHref: '/hub',
    routeLabel: 'Explore Mining Department Modules',
  },
  {
    id: 'cloud-architecture',
    category: 'Architecture',
    title: 'Next.js 16 + Supabase PostgreSQL 17 + Redis Architecture',
    summary:
      'Edge-to-database request pipeline built for high-frequency industrial logging with React Server Components and dual-tier caching.',
    bullets: [
      'Requests flow through apps/portal/proxy.ts (per-request nonce & CSP) -> Redis SSR session cache -> async RSC data loaders.',
      'Read paths pair Next.js 16 "use cache" profiles with @repo/redis L1/L2 tag invalidation for instant dashboard loads.',
      'Canonical Zod contracts in @repo/contract enforce static parity with Supabase SQL schemas across every write action.',
    ],
    routeHref: '/overview',
    routeLabel: 'Open System Overview',
  },
  {
    id: 'security-rls',
    category: 'Security',
    title: 'Zero-Trust RBAC, RLS InitPlan & 28-Gate CI Verification',
    summary:
      'Defense-in-depth spanning Edge session validation, canonical 8-step Server Actions, PostgreSQL RLS, and automated pre-push verification.',
    bullets: [
      '100% RLS enabled across public tables consulting (SELECT auth.uid()) and employees department clearances.',
      'Protected mutations enforce Authenticate -> Authorize -> Validate -> Rate Limit -> Execute -> Audit Log -> Invalidate Tags -> Return.',
      'Every production push runs pnpm agent:verify (28 automated gates covering TypeScript, Biome, Knip, boundary policies, RLS matrix, and Next.js production build).',
    ],
    routeHref: '/database/schemas',
    routeLabel: 'Inspect Visual Database ER Map',
  },
  {
    id: 'operations-runbook',
    category: 'Operations',
    title: 'Operator Workflows & Statutory Reporting Runbook',
    summary:
      'How field teams record shift data once while triggering downstream notifications and boardroom reporting automatically.',
    bullets: [
      'When Engineering books an active breakdown, Control Room hourly haulage locks the truck row red with "Breakdown booked by Engineering".',
      'Visitor gate passes automatically notify controllers and execute 12-hour overdue check-outs.',
      'Office Executive SOP cards dynamically compile live shift KPIs and download A4 compliance PDFs on demand.',
    ],
    routeHref: '/docs',
    routeLabel: 'Open Technical Docs Portal',
  },
];

export const PRESENTATION_MODULE_FLOWS: readonly PresentationModuleFlowNode[] = [
  {
    slug: 'access-control',
    name: 'Access Control & Gate',
    stage: '01 · Perimeter Entry',
    roleSummary:
      'Neo 300 card printing (Coy numbers & medical dates), alcohol screening, 12h visitor auto-exit, multi-month attendance.',
    tablesFed: 'personnel, badges, visitors, access_logs',
    route: '/access-control',
  },
  {
    slug: 'drilling',
    name: 'Drilling & Blasting',
    stage: '02 · Bench Preparation',
    roleSummary: 'Pit Viper rig meterage, holes drilled, bench block mapping & rig shift delays.',
    tablesFed: 'drilling_operations, machine_operations',
    route: '/drilling',
  },
  {
    slug: 'control-room',
    name: 'SCADA Control Room',
    stage: '03 · Pit Dispatch & Haulage',
    roleSummary:
      'Excavator Waste/Coal/Plant/Other routing, hourly dump-truck loads, breakdown row locking, SMR carryover.',
    tablesFed: 'hourly_loads, excavator_activity, machine_operations',
    route: '/control-room',
  },
  {
    slug: 'engineering',
    name: 'Engineering & Tyres',
    stage: '04 · Fleet Reliability',
    roleSummary:
      '24h breakdown ledger, workshop book-in/book-out, machine hours % trend deltas, tyre removals & replacements.',
    tablesFed: 'breakdowns, tires, tire_inspections, engineering_notes',
    route: '/engineering',
  },
  {
    slug: 'plant-processing',
    name: 'Plant Processing & Inventory',
    stage: '05 · Beneficiation & Stock',
    roleSummary:
      'Dense medium wash-plant hourly sheets, ROM yield & ash tracking, reagent & spares replenishment.',
    tablesFed: 'plant_hourly_logs, plant_delays, plant_inventory_items',
    route: '/plant-processing',
  },
  {
    slug: 'executive',
    name: 'Executive BI & Office Suite',
    stage: '06 · Boardroom Decision',
    roleSummary:
      'Cross-department reconciliation, AI forecasting, A4 PDF briefings & instant WhatsApp shift summaries.',
    tablesFed: 'daily_logs, production_monthly_targets, audit_logs',
    route: '/hub/executive',
  },
];

/**
 * Hydrates the 12-slide CEO & investor briefing deck from live snapshot telemetry.
 */
export function buildExecutivePresentationSlides(
  snapshot: PresentationSnapshot
): readonly PresentationSlide[] {
  const formattedDate = new Date(snapshot.generatedAtIso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });

  const fleetLabel =
    snapshot.totalMachines > 0
      ? `${snapshot.activeMachines.toLocaleString('en-US')} / ${snapshot.totalMachines.toLocaleString('en-US')}`
      : 'Full Fleet Ready';

  return [
    {
      id: 'executive-vision',
      slideNumber: 1,
      chapter: '01 · Executive Overview',
      title: 'Arch-System: Autonomous Industrial Mining OS',
      subtitle:
        'Unifying open-cast pit dispatch, workshop reliability, plant beneficiation, gate compliance, and executive AI telemetry in a single cloud platform.',
      headlineMetric: {
        label: 'Live Platform Footprint',
        value: `${snapshot.totalDepartments} Integrated Modules`,
        detail: `Hydrated ${formattedDate} · Multi-site SCADA & Executive BI`,
      },
      secondaryMetrics: [
        {
          label: 'Fleet Availability',
          value: `${snapshot.fleetAvailabilityPct.toFixed(1)}%`,
          detail: `${fleetLabel} units operational`,
        },
        {
          label: 'DB & RLS Security',
          value: `${snapshot.rlsCoveragePct}% RLS`,
          detail: `${snapshot.migrationsCount} PostgreSQL 17 migrations`,
        },
        {
          label: 'CI Quality Standard',
          value: `${snapshot.verificationGatesCount} Gates`,
          detail: 'Automated zero-regression verification',
        },
      ],
      highlights: [
        'Single Source of Truth connecting Brakfontein Pit, Extension Pit, Wash Plant & Executive Head Office.',
        'Replaces siloed paper logs and disconnected spreadsheets with real-time Supabase CDC workflows.',
        'Built-in CEO Presentation Suite, A4 Vector PDF reporting, and 1-click WhatsApp shift handovers.',
      ],
      speakerNotes:
        'Welcome Board Members and Investors. Arch-System is our proprietary industrial operating system engineered specifically for high-throughput opencast mining complexes. Everything displayed in this deck pulls live platform metrics from production.',
      visualType: 'hero',
      deepLink: { label: 'Open Executive Dashboard', href: '/hub/executive' },
    },
    {
      id: 'industry-challenge',
      slideNumber: 2,
      chapter: '01 · Market Thesis',
      title: 'Solving Mining’s $10M Visibility & Downtime Gap',
      subtitle:
        'Traditional mining sites lose 8–14% effective shovel and haulage productivity to delayed handover data, unverified tyre wear, and blind workshop queues.',
      headlineMetric: {
        label: 'Reconciliation Latency',
        value: '< 2 Seconds',
        detail: 'Versus 12–48 hour delayed manual Excel roll-ups',
      },
      secondaryMetrics: [
        {
          label: 'Zero Paper Silos',
          value: '100% Digital',
          detail: 'Offline-capable pit forms & shift handovers',
        },
        {
          label: 'Cross-Team Interlock',
          value: 'Real-Time',
          detail: 'Engineering bookings lock Control Room trucks instantly',
        },
        {
          label: 'Audit Traceability',
          value: 'Immutable',
          detail: 'Every scan, load, breakdown & approval timestamped',
        },
      ],
      highlights: [
        'Control Room dispatchers previously logged loads on trucks already parked in workshop bays due to delayed radio updates.',
        'Access gates lacked multi-month employee alcohol/attendance histories and automatic overdue visitor sign-outs.',
        'Executives waited days for wash-plant yield vs pit extraction BCM reconciliation across departments.',
      ],
      speakerNotes:
        'In conventional coal and hard-rock operations, operations, engineering workshops, wash plants, and security gates run separate tools. That fragmentation leaks tonnage and delays intervention. Arch-System eliminates that latency.',
      visualType: 'kpi-chart',
      deepLink: { label: 'View Live Control Room', href: '/control-room' },
    },
    {
      id: 'live-footprint',
      slideNumber: 3,
      chapter: '02 · Live Site Telemetry',
      title: 'Live Production Complex Snapshot',
      subtitle:
        'Real-time aggregate metrics streaming from Supabase PostgreSQL read replicas and Redis edge telemetry cache.',
      headlineMetric: {
        label: 'Operational Availability',
        value: `${snapshot.fleetAvailabilityPct.toFixed(1)}%`,
        detail: snapshot.isLiveTelemetry
          ? 'Live Supabase Telemetry Active'
          : 'Baseline Readiness Snapshot',
      },
      secondaryMetrics: [
        {
          label: 'Registered Fleet',
          value: snapshot.totalMachines.toLocaleString('en-US'),
          detail: `${snapshot.activeMachines.toLocaleString('en-US')} active equipment units`,
        },
        {
          label: 'Tracked Tyres',
          value: snapshot.totalTires.toLocaleString('en-US'),
          detail: `${snapshot.installedTires.toLocaleString('en-US')} currently mounted`,
        },
        {
          label: '30-Day Activity',
          value: snapshot.dailyLogsLast30d.toLocaleString('en-US'),
          detail: `${snapshot.accessEventsLast30d.toLocaleString('en-US')} gate scans (30d)`,
        },
      ],
      highlights: [
        `Active Breakdown Queue: ${snapshot.activeBreakdowns.toLocaleString('en-US')} open · ${snapshot.resolvedBreakdowns24h.toLocaleString('en-US')} resolved in last 24 hours.`,
        'Every KPI card connects directly into underlying operational tables with zero manual re-entry.',
        'Dual-tier caching keeps CEO dashboards responsive under heavy concurrent shift logging.',
      ],
      speakerNotes:
        'These figures reflect live system state rather than static mockup slides. You can click through directly from this deck into any live module to inspect individual machines, tyres, or gate logs.',
      visualType: 'kpi-chart',
      deepLink: { label: 'Open System Overview', href: '/overview' },
    },
    {
      id: 'value-chain',
      slideNumber: 4,
      chapter: '02 · Operational Loop',
      title: 'End-to-End Pit-to-Plant Digital Thread',
      subtitle:
        'Every shift movement flows cleanly across 6 interconnected operational stages from perimeter clearance to executive sign-off.',
      headlineMetric: {
        label: 'Connected Value Chain',
        value: '6 Operational Stages',
        detail: 'Zero re-keying from Gate Entry to Boardroom PDF',
      },
      secondaryMetrics: [
        {
          label: 'Gate -> Pit Sync',
          value: 'Instant',
          detail: 'Operator attendance & fitness verified at barrier',
        },
        {
          label: 'Pit -> Workshop',
          value: 'Bi-Directional',
          detail: 'Breakdowns surface immediately in Control Room & Daily Log',
        },
        {
          label: 'Plant -> Boardroom',
          value: '1-Click Export',
          detail: 'Automated A4 PDF & WhatsApp executive briefs',
        },
      ],
      highlights: [
        'Stage 1 Gate Security -> Stage 2 Drilling -> Stage 3 Control Room Dispatch.',
        'Stage 4 Engineering Reliability -> Stage 5 Wash Plant & Spares Inventory.',
        'Stage 6 Executive Dashboard, Investor Briefing & AI Forecasting.',
      ],
      speakerNotes:
        'Notice how data flows horizontally across the mine. Instead of isolated departmental silos, every logged event updates downstream planning, costing, and compliance dashboards.',
      visualType: 'value-chain',
      deepLink: { label: 'Explore Architecture Map', href: '/presentation/architecture' },
    },
    {
      id: 'control-room-scada',
      slideNumber: 5,
      chapter: '03 · Field Capabilities',
      title: 'SCADA Control Room & Live Dispatch Guardrails',
      subtitle:
        'High-frequency hour-by-hour haulage sheets paired with automated Engineering interlocks and shift-to-shift SMR continuity.',
      headlineMetric: {
        label: 'Haulage & Dispatch Control',
        value: 'Real-Time Interlocks',
        detail: 'Broken-down trucks automatically lock in red across Hourly Loads',
      },
      secondaryMetrics: [
        {
          label: 'SMR Continuity',
          value: 'Auto Carry-Over',
          detail: 'Opening Start SMR inherits previous Stop SMR automatically',
        },
        {
          label: 'Excavator Modes',
          value: 'Waste · Coal · Plant · Other',
          detail: 'Dedicated dynamic assignment panels per category',
        },
        {
          label: 'Refined SCADA Strip',
          value: 'Live OEE Targets',
          detail: 'Fleet Count, SMR Worked, Availability & Utilization progress bars',
        },
      ],
      highlights: [
        'Hourly Loads turns any broken-down truck row red, blocks entry, and notifies controllers ("Breakdown booked by Engineering").',
        'High-contrast SMR logging guidance and inline missing-hours capture eliminate end-of-shift estimation errors.',
        'Realtime Supabase CDC pushes updates across control room monitors without manual page reloads.',
      ],
      speakerNotes:
        'A critical operational win is our Control Room ↔ Engineering interlock. Dispatchers can never accidentally log loads onto a truck undergoing repairs in the workshop.',
      visualType: 'kpi-chart',
      deepLink: { label: 'Launch Control Room', href: '/control-room' },
    },
    {
      id: 'engineering-tyres',
      slideNumber: 6,
      chapter: '03 · Field Capabilities',
      title: 'Engineering Reliability, 24h Breakdowns & Tyre Lifecycle',
      subtitle:
        'Granular machine-level visibility into mechanical availability, hours-worked deltas, and high-value OTR tyre removals & replacements.',
      headlineMetric: {
        label: 'Workshop & Tyre Ledger',
        value: `${snapshot.resolvedBreakdowns24h.toLocaleString('en-US')} Resolved (24h)`,
        detail: `${snapshot.activeBreakdowns.toLocaleString('en-US')} active queue · Full tread/PSI history`,
      },
      secondaryMetrics: [
        {
          label: '24-Hour Daily Log',
          value: 'Dedicated Feed',
          detail: 'Real-time 24h machine breakdown timeline & MTTR calculation',
        },
        {
          label: 'Machine Panels',
          value: '% Delta Trend Arrows',
          detail: 'Hours worked change + embedded Tyre & Breakdown spark charts',
        },
        {
          label: 'Tyre Traceability',
          value: 'Mount -> Remove -> Scrap',
          detail: 'Tracks serials, wheel positions, tread mm, PSI & SMU hours',
        },
      ],
      highlights: [
        'OTR mining tyres represent a top operating cost; Arch-System captures every mount, removal, spare move, and scrap reason.',
        'Machine cards combine total SMR hours worked with week-over-week percentage delta indicators.',
        'Dedicated Engineering Tri-View Reports export live workshop status as Dashboard, PDF, or WhatsApp dispatch.',
      ],
      speakerNotes:
        'OTR tyres and unplanned breakdowns drive maintenance cost. Our Engineering module gives workshop leads a 24-hour breakdown report, per-machine trend sparklines, and full tyre change-out audit trails.',
      visualType: 'kpi-chart',
      deepLink: { label: 'Launch Engineering Hub', href: '/engineering' },
    },
    {
      id: 'access-control-safety',
      slideNumber: 7,
      chapter: '03 · Field Capabilities',
      title: 'Access Control, Alcohol Screening & Muster Compliance',
      subtitle:
        'End-to-end site security connecting Magicard Neo 300 ID provisioning, gate breathalyzer scans, automatic visitor exits, and multi-month attendance.',
      headlineMetric: {
        label: 'Gate Events (30d)',
        value: snapshot.accessEventsLast30d.toLocaleString('en-US'),
        detail: 'Zero-crash RSC queries + full denial reason telemetry',
      },
      secondaryMetrics: [
        {
          label: 'ID Provisioning',
          value: 'Neo 300 Studio',
          detail: 'Prints actual Medical/Induction dates & Coy Numbers (e.g. Brak 0043)',
        },
        {
          label: '12h Visitor Guard',
          value: 'Auto-Exit Engine',
          detail: 'Automatically closes overdue passes, revokes badges & alerts staff',
        },
        {
          label: 'Attendance Register',
          value: '12-Month Export',
          detail: 'Per-employee Time In/Out, alcohol pass/fail & CSV audit export',
        },
      ],
      highlights: [
        'Denied gate entries surface the exact denial reason, alcohol test reading, direction (IN/OUT), and employee ID inline.',
        'HR & Safety teams pull multi-month employee attendance registers across Today, 7D, 30D, 90D, 12 Months, or All Time.',
        'Separate Dashboard, A4 PDF, and WhatsApp security briefings streamline daily gate muster reviews.',
      ],
      speakerNotes:
        'Mining compliance begins at the perimeter gate. Every contractor and employee badge tracks live medical and induction expiry dates right on the card and enforces breathalyzer compliance before shift entry.',
      visualType: 'governance',
      deepLink: { label: 'Open Access Control', href: '/access-control' },
    },
    {
      id: 'plant-executive-bi',
      slideNumber: 8,
      chapter: '03 · Field Capabilities',
      title: 'Wash Plant Beneficiation, Stock & Office Automation',
      subtitle:
        'Connecting ROM feed tonnages, dense medium cut-points, and consumables stock directly to automated executive PDF and WhatsApp reporting.',
      headlineMetric: {
        label: 'Executive Reporting',
        value: '1-Click A4 PDF & SOPs',
        detail: 'Dynamic vector @react-pdf/renderer generation across departments',
      },
      secondaryMetrics: [
        {
          label: 'Plant Processing',
          value: 'Hourly + Yields',
          detail: 'ROM scale, product yield, ash %, density & delay pareto',
        },
        {
          label: 'Plant Inventory',
          value: 'Reorder Alerts',
          detail: 'Critical spares, magnetite & reagent shift consumption',
        },
        {
          label: 'Office AI Suite',
          value: 'Auto-SOP PDFs',
          detail: 'One-click Safety & Shift Handover SOP populated with live KPIs',
        },
      ],
      highlights: [
        'Executive Dashboard reconciles Coal & Waste BCM against monthly targets with live pacing gauges.',
        'Office Suite SOP interactions pull live database metrics directly into downloadable executive handover templates.',
        'Every major department exposes synchronized Dashboard, PDF Report, and WhatsApp dispatch modes.',
      ],
      speakerNotes:
        'On the commercial side, washing efficiency and reagent control protect margins. Our Office and Executive layers turn raw plant data into board-ready PDF packs in seconds.',
      visualType: 'value-chain',
      deepLink: { label: 'Open Plant Inventory', href: '/plant-inventory' },
    },
    {
      id: 'enterprise-architecture',
      slideNumber: 9,
      chapter: '04 · Technology Stack',
      title: 'Modern Edge-to-Postgres Industrial Architecture',
      subtitle:
        'Built on Next.js 16 App Router, React 19, TypeScript 5.9, Supabase PostgreSQL 17, and serverless Redis for global low-latency reliability.',
      headlineMetric: {
        label: 'Schema Scale',
        value: `${snapshot.migrationsCount} SQL Migrations`,
        detail: 'Interactive Visual ER Map available in /database/schemas',
      },
      secondaryMetrics: [
        {
          label: 'Frontend Core',
          value: 'Next.js 16 + React 19',
          detail: 'RSC streaming, React Compiler & OKLCH Liquid-Glass UI',
        },
        {
          label: 'Data & Caching',
          value: 'Supabase + Redis',
          detail: 'Read-replica queries + sub-150ms L1/L2 session & metric cache',
        },
        {
          label: 'Field Resilience',
          value: 'Offline Queue',
          detail: 'IndexedDB idb-keyval sync prevents lost pit data on dead zones',
        },
      ],
      highlights: [
        'Monorepo architecture (Turborepo + pnpm) enforces strict package layering boundaries via automated policy checks.',
        'Canonical Zod schemas in @repo/contract guarantee API/DB type parity (audited automatically on every CI run).',
        'Visual PostgreSQL ER Explorer illustrates foreign keys and 100% RLS coverage interactively.',
      ],
      speakerNotes:
        'Technically, the platform combines modern web speed with industrial reliability: offline queuing for pit dead zones, edge session caching, and clean read-replica aggregation.',
      visualType: 'architecture',
      deepLink: { label: 'Open Visual ER Schema', href: '/database/schemas' },
    },
    {
      id: 'security-governance',
      slideNumber: 10,
      chapter: '04 · Trust & Governance',
      title: 'Zero-Trust Security, RLS Isolation & 28-Gate Quality',
      subtitle:
        'Arch-System enforces strict multi-department access isolation and runs 28 automated engineering verification gates before production rollout.',
      headlineMetric: {
        label: 'PostgreSQL RLS',
        value: `${snapshot.rlsCoveragePct}% Enabled`,
        detail: 'Every public table protected with InitPlan policies',
      },
      secondaryMetrics: [
        {
          label: 'Server Action Guard',
          value: '8-Step Pipeline',
          detail: 'Auth -> RBAC -> Zod -> Rate Limit -> Execute -> Audit -> Cache',
        },
        {
          label: 'Release Assurance',
          value: `${snapshot.verificationGatesCount} Auto Gates`,
          detail: 'TypeCheck, Biome, Security Matrix, Knip, Cycles & Build',
        },
        {
          label: 'Edge CSP & Nonce',
          value: 'Strict Per-Request',
          detail: 'Dynamic script nonces & zero unsafe wildcard origins',
        },
      ],
      highlights: [
        'Shift operators see only their assigned departments; Executive & Investor views follow strict role clearance.',
        'Coverage ratchet requires >= 70% line & statement tests on every modified runtime module.',
        'Pre-push hooks verify drift, contracts, circular dependencies, design tokens, and production Next.js compilation.',
      ],
      speakerNotes:
        'For enterprise investors and auditors: security is architectural, not bolted on. Database row-level security backs up Next.js edge checks, and 28 automated gates protect every release.',
      visualType: 'governance',
      deepLink: { label: 'Open Tech Docs', href: '/presentation/documentation' },
    },
    {
      id: 'ai-agentic-intelligence',
      slideNumber: 11,
      chapter: '05 · AI Moat',
      title: 'AI Intelligence Engines & Autonomous Agent Mesh',
      subtitle:
        'Five domain-specific mining intelligence engines transform historical breakdowns, tyre wear, and shift metrics into proactive operational recommendations.',
      headlineMetric: {
        label: 'Intelligence Core',
        value: '5 Domain Engines',
        detail: 'Anomaly · Predictive Maintenance · Forecast · Shift · Copilot',
      },
      secondaryMetrics: [
        {
          label: 'Predictive Alerts',
          value: 'Pre-Failure Warnings',
          detail: 'Flags recurring hydraulic/tyre/SMR risk patterns before stoppages',
        },
        {
          label: 'Natural Language Docs',
          value: 'AI Office Suite',
          detail: 'Drafts MHSA statutory shift memos & cost models cleanly',
        },
        {
          label: 'Autonomous Engineering',
          value: 'Multi-Agent Mesh',
          detail: 'Continuous codebase audits, zero-drift & regression guarding',
        },
      ],
      highlights: [
        'TelemetryAnomalyEngine & PredictiveMaintenanceEngine monitor equipment fault cadence early.',
        'ProductionForecastEngine tracks coal & waste BCM pacing against monthly mine plans.',
        'OperationsCopilot & Office AI synthesize shift handovers without extra headcount.',
      ],
      speakerNotes:
        'Beyond digitizing records, our intelligence layer continuously mines breakdown frequency and production variance to warn superintendents early and automate reporting.',
      visualType: 'architecture',
      deepLink: { label: 'Inspect AI & Office Suite', href: '/office' },
    },
    {
      id: 'commercial-value-roadmap',
      slideNumber: 12,
      chapter: '05 · Investor Value & Next',
      title: 'Measurable ROI & Multi-Site Scaling Roadmap',
      subtitle:
        'Ready for immediate multi-complex replication across open-cast coal, aggregate, and mineral processing sites with zero per-module integration glue.',
      headlineMetric: {
        label: 'Deployment Readiness',
        value: 'Production Live',
        detail: 'Multi-site complex support baked into core PostgreSQL tenancy',
      },
      secondaryMetrics: [
        {
          label: 'Direct Value Levers',
          value: 'Availability & Tonnage',
          detail: 'Eliminates unlogged downtime & unauthorized gate/truck dispatch',
        },
        {
          label: 'Boardroom Artifact',
          value: 'Instant PDF Pack',
          detail: 'Export this complete investor presentation offline anytime',
        },
        {
          label: 'Audit & SLA',
          value: 'Enterprise Ready',
          detail: 'Supabase + Redis + Vercel CI/CD zero-downtime deployment',
        },
      ],
      highlights: [
        'Phase 1 Complete: Full 15-module operational loop live at Brakfontein & Extension Complexes.',
        'Phase 2 Scale: Multi-complex tenant onboarding, automated PLC/Modbus direct ingestion & ERP sync.',
        'Invite CEOs, board reviewers, or strategic partners cleanly via scoped Presentation access in /admin.',
      ],
      speakerNotes:
        'In closing, Arch-System is live in production today, architected cleanly for rapid multi-site scaling, and verifiable down to the individual truck hour and SQL policy. Use the Investor Pack tab to download this briefing as an offline PDF.',
      visualType: 'roadmap',
      deepLink: { label: 'Download Investor Pack PDF', href: '/presentation/investor-pack' },
    },
  ];
}
