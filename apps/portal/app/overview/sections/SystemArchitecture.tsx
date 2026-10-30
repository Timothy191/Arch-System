import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  GitCommit,
  Layers,
  LayoutGrid,
  Lock,
  Network,
  Server,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  BACKEND_SERVICES,
  DATABASE_SCHEMA,
  DEPARTMENTS,
  EXAMPLE_BACKEND_FLOW_PIPELINES,
  GIT_PROVENANCE_METRICS,
} from '../lib/data';
import { SystemArchitectureNodeCanvas } from './SystemArchitectureNodeCanvas';

const ARCHITECTURAL_PILLARS = [
  {
    title: 'Next.js 16.4.3 App Router + RSC',
    subtitle: 'Client / Server Boundary',
    badge: 'Cache Components',
    description:
      'All primary data fetching runs in React Server Components, Server Actions, and Route Handlers with named cacheLife() profiles and tag invalidation.',
    icon: Layers,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10 border-accent-blue/20',
  },
  {
    title: 'Zero-Trust Supabase PostgreSQL 17',
    subtitle: '213 Versioned Migrations',
    badge: '100% RLS InitPlan',
    description:
      'Every table enforces Row Level Security with cached (select auth.uid()) InitPlan policies, atomic PL/pgSQL RPCs, and read-replica routing.',
    icon: Database,
    color: 'text-accent-green',
    bg: 'bg-accent-green/10 border-accent-green/20',
  },
  {
    title: 'Hybrid L1 LRU + L2 Upstash Redis 7.4',
    subtitle: 'Sub-2ms State & Locking',
    badge: 'Redlock Mutex',
    description:
      'Two-tier caching layer pairing in-process LRU L1 memory with Upstash REST L2 pipelines and distributed Redlock mutexes for shift closeouts.',
    icon: Zap,
    color: 'text-accent-amber',
    bg: 'bg-accent-amber/10 border-accent-amber/20',
  },
  {
    title: 'Strict Monorepo Policy Compiler',
    subtitle: 'Zero Architectural Drift',
    badge: '8/8 Gates Pass',
    description:
      'Apps never import @repo/database directly (routed via @repo/supabase), @repo/ui remains pure presentational, and @repo/contract validates all boundaries.',
    icon: ShieldCheck,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10 border-accent-blue/20',
  },
] as const;

export default function SystemArchitecture() {
  const [viewMode, setViewMode] = useState<'cards' | 'node-canvas' | 'both'>('cards');
  const totalRoutes = DEPARTMENTS.reduce((sum, d) => sum + d.routes.length, 0);
  const timeWorked = GIT_PROVENANCE_METRICS.calculateTimeWorked();

  return (
    <div className="space-y-8">
      {/* Design-System Panel for End-to-End System Architecture Topology Header, KPIs & View Toggle */}
      <Card
        data-testid="system-architecture-header-panel"
        className="relative space-y-5 overflow-hidden border border-white/60 bg-white/80 p-6 shadow-glass-depth backdrop-blur-2xl"
      >
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-accent-blue via-emerald-500 to-indigo-600" />

        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-0.5 font-mono font-semibold text-[10px] text-accent-blue uppercase tracking-wider">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-blue" />
              Multi-Tier Industrial Architecture · Zero-Proxy RLS
            </div>
            <h2 className="flex items-center gap-2.5 font-semibold text-2xl text-text-heading">
              <Network className="h-6 w-6 shrink-0 text-accent-blue" />
              End-to-End System Architecture Topology
            </h2>
            <p className="max-w-3xl text-sm text-text-secondary">
              Multi-tier industrial architecture connecting 8 Core Operational Modules to Supabase
              PostgreSQL 17, Hybrid Redis 7.4, and real-time SCADA telemetry
            </p>
          </div>

          {/* View Mode Segmented Toggle (Standard Cards View vs n8n Node Canvas View) */}
          <div
            data-testid="architecture-view-toggle"
            role="group"
            aria-label="Architecture visualization mode"
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-xl border border-border-subtle bg-bg-secondary p-1 shadow-inner"
          >
            <button
              type="button"
              data-testid="view-toggle-cards"
              aria-pressed={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
                viewMode === 'cards'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-secondary hover:bg-white/60 hover:text-text-heading'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards & Flow View</span>
            </button>
            <button
              type="button"
              data-testid="view-toggle-n8n"
              aria-pressed={viewMode === 'node-canvas'}
              onClick={() => setViewMode('node-canvas')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
                viewMode === 'node-canvas'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-secondary hover:bg-white/60 hover:text-text-heading'
              }`}
            >
              <Workflow className="h-3.5 w-3.5" />
              <span>n8n Node Canvas</span>
              <span
                className={`rounded px-1.5 py-0.2 font-mono text-[9px] ${
                  viewMode === 'node-canvas'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/15 text-emerald-700'
                }`}
              >
                Boxes & Wires
              </span>
            </button>
            <button
              type="button"
              data-testid="view-toggle-both"
              aria-pressed={viewMode === 'both'}
              onClick={() => setViewMode('both')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
                viewMode === 'both'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-secondary hover:bg-white/60 hover:text-text-heading'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Combined View</span>
            </button>
          </div>
        </div>

        {/* 5 Design-System KPI Tiles inside Panel */}
        <div className="grid grid-cols-2 gap-3 border-border-subtle border-t pt-3 sm:grid-cols-5">
          <div className="rounded-xl border border-border-subtle bg-bg-secondary/80 px-4 py-2.5">
            <div className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
              Core Modules
            </div>
            <div className="mt-0.5 font-bold text-lg text-text-heading">
              {DEPARTMENTS.length} / 8
            </div>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-secondary/80 px-4 py-2.5">
            <div className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
              Active Routes
            </div>
            <div className="mt-0.5 font-bold text-accent-blue text-lg">{totalRoutes}</div>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-secondary/80 px-4 py-2.5">
            <div className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
              DB Migrations
            </div>
            <div className="mt-0.5 font-bold text-accent-green text-lg">
              {GIT_PROVENANCE_METRICS.totalMigrations}
            </div>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-secondary/80 px-4 py-2.5">
            <div className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
              Backend Nodes
            </div>
            <div className="mt-0.5 font-bold text-lg text-text-heading">
              {BACKEND_SERVICES.length}
            </div>
          </div>
          <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 sm:col-span-1">
            <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 uppercase tracking-wider">
              <Clock className="h-3 w-3" />
              Time Worked
            </div>
            <div className="mt-0.5 font-bold text-emerald-900 text-lg">
              {timeWorked.activeEngineeringHours}h ({timeWorked.calendarDays}d)
            </div>
          </div>
        </div>
      </Card>

      {/* Interactive n8n-Style Node & Wire Canvas (shown when 'node-canvas' or 'both' is active) */}
      {(viewMode === 'node-canvas' || viewMode === 'both') && <SystemArchitectureNodeCanvas />}

      {/* Existing Cards & Flow View (kept intact as-is; shown when 'cards' or 'both' is active) */}
      {(viewMode === 'cards' || viewMode === 'both') && (
        <div className="space-y-8" data-testid="architecture-cards-flow-view">
          {/* 4 Architectural Pillars */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ARCHITECTURAL_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card key={pillar.title} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`rounded-lg border p-2 ${pillar.bg}`}>
                        <Icon className={`h-4 w-4 ${pillar.color}`} />
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {pillar.badge}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 font-semibold text-sm text-text-heading">
                      {pillar.title}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {pillar.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-text-secondary text-xs leading-relaxed">
                      {pillar.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Layered Request & Data Flow Topology */}
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-base text-text-heading">
                  <Layers className="h-4 w-4 text-accent-blue" />
                  Layered Execution & Security Pipeline
                </h3>
                <p className="mt-0.5 text-text-secondary text-xs">
                  Zero-proxy request flow from Edge authentication through Server Actions to
                  Supabase PostgreSQL 17 RLS
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-accent-green/30 bg-accent-green/10 font-mono text-[10px] text-accent-green"
              >
                Zero Boundary Violations
              </Badge>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
              {/* Tier 1 */}
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-tertiary p-4">
                <div>
                  <div className="font-mono font-semibold text-[10px] text-accent-blue uppercase tracking-wider">
                    Tier 01 · Edge & Auth
                  </div>
                  <div className="mt-1 font-semibold text-sm text-text-heading">
                    Next.js 16 Proxy & SSR Session
                  </div>
                  <p className="mt-2 text-text-secondary text-xs">
                    Validates HttpOnly PKCE cookies, enforces CSP nonces, and resolves employee role
                    + department claims.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-border-subtle border-t pt-2 font-mono text-[11px] text-text-muted">
                  <span>proxy.ts</span>
                  <Lock className="h-3.5 w-3.5 text-accent-green" />
                </div>
              </div>

              {/* Tier 2 */}
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-tertiary p-4">
                <div>
                  <div className="font-mono font-semibold text-[10px] text-accent-blue uppercase tracking-wider">
                    Tier 02 · Presentation
                  </div>
                  <div className="mt-1 font-semibold text-sm text-text-heading">
                    8 Core Operational Modules
                  </div>
                  <p className="mt-2 text-text-secondary text-xs">
                    Pure light-mode OKLCH UI (@repo/ui + @repo/theme) with React 19 transitions and
                    TanStack Query state sync.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-border-subtle border-t pt-2 font-mono text-[11px] text-text-muted">
                  <span>apps/portal</span>
                  <Building2 className="h-3.5 w-3.5 text-accent-blue" />
                </div>
              </div>

              {/* Tier 3 */}
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-tertiary p-4">
                <div>
                  <div className="font-mono font-semibold text-[10px] text-accent-blue uppercase tracking-wider">
                    Tier 03 · Contract & RPC
                  </div>
                  <div className="mt-1 font-semibold text-sm text-text-heading">
                    Server Actions + @repo/contract
                  </div>
                  <p className="mt-2 text-text-secondary text-xs">
                    Authenticate → Authorize → Validate via Zod (@repo/contract) → Rate-limit via
                    Redis → Invalidate cache tags.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-border-subtle border-t pt-2 font-mono text-[11px] text-text-muted">
                  <span>@repo/contract</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-green" />
                </div>
              </div>

              {/* Tier 4 */}
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-tertiary p-4">
                <div>
                  <div className="font-mono font-semibold text-[10px] text-accent-green uppercase tracking-wider">
                    Tier 04 · Data Gateway
                  </div>
                  <div className="mt-1 font-semibold text-sm text-text-heading">
                    @repo/supabase Primary & Replica
                  </div>
                  <p className="mt-2 text-text-secondary text-xs">
                    Routes analytical dashboard reads to createReadReplicaClient() and transactional
                    writes to primary PostgreSQL 17.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-border-subtle border-t pt-2 font-mono text-[11px] text-text-muted">
                  <span>@repo/supabase</span>
                  <Server className="h-3.5 w-3.5 text-accent-green" />
                </div>
              </div>

              {/* Tier 5 */}
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-tertiary p-4">
                <div>
                  <div className="font-mono font-semibold text-[10px] text-accent-amber uppercase tracking-wider">
                    Tier 05 · Storage & Telemetry
                  </div>
                  <div className="mt-1 font-semibold text-sm text-text-heading">
                    PostgreSQL 17 + Redis + SCADA
                  </div>
                  <p className="mt-2 text-text-secondary text-xs">
                    {GIT_PROVENANCE_METRICS.totalMigrations} migrations, {DATABASE_SCHEMA.length}{' '}
                    core tables, Hybrid L1/L2 Redis 7.4, FUXA Modbus/OPC-UA, and C66 gate hardware.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-border-subtle border-t pt-2 font-mono text-[11px] text-text-muted">
                  <span>@repo/database</span>
                  <Cpu className="h-3.5 w-3.5 text-accent-amber" />
                </div>
              </div>
            </div>
          </Card>

          {/* Visual Block-and-Line Example Backend Flow Diagrams */}
          <Card className="p-6" data-testid="visual-block-line-diagrams">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-base text-text-heading">
                  <GitCommit className="h-4 w-4 text-accent-blue" />
                  Visual Block-and-Line Architecture & Cross-Department Data Flows
                </h3>
                <p className="mt-0.5 text-text-secondary text-xs">
                  End-to-end block-and-line illustrations showing how field telemetry, shift
                  budgets, and badge credentials flow across backend services
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-accent-blue/30 bg-accent-blue/10 font-mono text-[10px] text-accent-blue"
              >
                3 Live Inter-Department Pipelines
              </Badge>
            </div>

            <div className="space-y-6">
              {EXAMPLE_BACKEND_FLOW_PIPELINES.map((pipeline) => (
                <div
                  key={pipeline.id}
                  className="space-y-4 rounded-xl border border-border-subtle bg-bg-secondary/60 p-4"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <h4 className="font-semibold text-sm text-text-heading">{pipeline.title}</h4>
                      <p className="text-text-secondary text-xs">{pipeline.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="w-fit font-mono text-[10px]">
                      {pipeline.badge}
                    </Badge>
                  </div>

                  {/* Connected Blocks & Directional Lines */}
                  <div className="grid grid-cols-1 items-center gap-2 lg:grid-cols-9">
                    {pipeline.nodes.map((node, idx) => (
                      <div key={node.id} className="contents">
                        {/* Block Node */}
                        <div
                          className="relative flex min-h-[148px] flex-col justify-between rounded-xl border-2 bg-white p-3 shadow-sm lg:col-span-1"
                          style={{ borderColor: `${node.color}55` }}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="rounded px-1.5 py-0.5 font-bold font-mono text-[9px]"
                                style={{
                                  backgroundColor: `${node.color}18`,
                                  color: node.color,
                                }}
                              >
                                {node.step}
                              </span>
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: node.color }}
                              />
                            </div>
                            <div className="mt-1.5 font-semibold text-text-heading text-xs leading-snug">
                              {node.title}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-text-muted">
                              {node.role}
                            </div>
                            <p className="mt-1.5 text-[11px] text-text-secondary leading-relaxed">
                              {node.detail}
                            </p>
                          </div>
                          <div className="mt-2 truncate border-border-subtle border-t pt-1.5 font-mono text-[9px] text-accent-blue">
                            {node.protocol}
                          </div>
                        </div>

                        {/* Connecting Line + Arrow between blocks */}
                        {idx < pipeline.nodes.length - 1 && (
                          <div className="flex items-center justify-center py-1 lg:col-span-1 lg:flex-col lg:py-0">
                            <div className="hidden w-full items-center lg:flex">
                              <div
                                className="h-0.5 flex-1"
                                style={{
                                  background: `linear-gradient(90deg, ${node.color}, ${
                                    pipeline.nodes[idx + 1]?.color ?? node.color
                                  })`,
                                }}
                              />
                              <ArrowRight
                                className="-ml-1 h-4 w-4 shrink-0"
                                style={{ color: pipeline.nodes[idx + 1]?.color ?? node.color }}
                              />
                            </div>
                            <span className="mt-1 rounded border border-border-subtle bg-bg-tertiary px-1.5 py-0.5 font-mono text-[9px] text-text-muted">
                              {node.protocol}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Hub -> 8 Core Operational Modules Topology Grid */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-base text-text-heading">
                  <Activity className="h-4 w-4 text-accent-green" />
                  Central Hub Routing Topology (8 / 8 Active Modules)
                </h3>
                <p className="mt-0.5 text-text-secondary text-xs">
                  Direct navigation and RBAC boundary mapping from Central Command (/hub) to all 8
                  operational modules
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {DEPARTMENTS.map((dept) => (
                <Card key={dept.id} className="overflow-hidden transition-shadow hover:shadow-md">
                  <div className="h-1" style={{ backgroundColor: dept.color }} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-semibold text-sm text-text-heading">
                        {dept.name}
                      </CardTitle>
                      <span className="font-mono text-[11px] text-text-muted">/{dept.slug}</span>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs">
                      {dept.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap gap-1">
                      {dept.routes.slice(0, 4).map((r) => (
                        <span
                          key={r.path}
                          className="rounded bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary"
                        >
                          {r.name}
                        </span>
                      ))}
                      {dept.routes.length > 4 && (
                        <span className="rounded bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-muted">
                          +{dept.routes.length - 4} more
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-border-subtle border-t pt-2">
                      <span className="font-mono text-[10px] text-text-muted">
                        {dept.roles.length} RBAC roles
                      </span>
                      <Link
                        href={`/${dept.slug}`}
                        className="inline-flex items-center gap-1 font-medium text-accent-blue text-xs hover:underline"
                      >
                        Open Module
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
