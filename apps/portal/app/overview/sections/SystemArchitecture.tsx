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
    title: 'Next.js 16.3.8 App Router + RSC',
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
    subtitle: '189 Versioned Migrations',
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
        className="p-6 border border-white/60 bg-white/80 backdrop-blur-2xl shadow-glass-depth space-y-5 relative overflow-hidden"
      >
        <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-accent-blue via-emerald-500 to-indigo-600" />

        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-[10px] font-mono uppercase tracking-wider text-accent-blue font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
              Multi-Tier Industrial Architecture · Zero-Proxy RLS
            </div>
            <h2 className="text-2xl font-semibold text-text-heading flex items-center gap-2.5">
              <Network className="w-6 h-6 text-accent-blue shrink-0" />
              End-to-End System Architecture Topology
            </h2>
            <p className="text-text-secondary text-sm max-w-3xl">
              Multi-tier industrial architecture connecting 8 Core Operational Modules to Supabase
              PostgreSQL 17, Hybrid Redis 7.4, and real-time SCADA telemetry
            </p>
          </div>

          {/* View Mode Segmented Toggle (Standard Cards View vs n8n Node Canvas View) */}
          <div
            data-testid="architecture-view-toggle"
            role="group"
            aria-label="Architecture visualization mode"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-bg-secondary border border-border-subtle self-start shrink-0 shadow-inner"
          >
            <button
              type="button"
              data-testid="view-toggle-cards"
              aria-pressed={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-heading hover:bg-white/60'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards & Flow View</span>
            </button>
            <button
              type="button"
              data-testid="view-toggle-n8n"
              aria-pressed={viewMode === 'node-canvas'}
              onClick={() => setViewMode('node-canvas')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'node-canvas'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-heading hover:bg-white/60'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>n8n Node Canvas</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'both'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-heading hover:bg-white/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Combined View</span>
            </button>
          </div>
        </div>

        {/* 5 Design-System KPI Tiles inside Panel */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-border-subtle">
          <div className="px-4 py-2.5 rounded-xl bg-bg-secondary/80 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Core Modules
            </div>
            <div className="text-lg font-bold text-text-heading mt-0.5">
              {DEPARTMENTS.length} / 8
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-bg-secondary/80 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Active Routes
            </div>
            <div className="text-lg font-bold text-accent-blue mt-0.5">{totalRoutes}</div>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-bg-secondary/80 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              DB Migrations
            </div>
            <div className="text-lg font-bold text-accent-green mt-0.5">
              {GIT_PROVENANCE_METRICS.totalMigrations}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-bg-secondary/80 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Backend Nodes
            </div>
            <div className="text-lg font-bold text-text-heading mt-0.5">
              {BACKEND_SERVICES.length}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Time Worked
            </div>
            <div className="text-lg font-bold text-emerald-900 mt-0.5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {ARCHITECTURAL_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card key={pillar.title} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`p-2 rounded-lg border ${pillar.bg}`}>
                        <Icon className={`w-4 h-4 ${pillar.color}`} />
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {pillar.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-semibold text-text-heading mt-2">
                      {pillar.title}
                    </CardTitle>
                    <CardDescription className="text-xs font-mono">
                      {pillar.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {pillar.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Layered Request & Data Flow Topology */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-text-heading flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent-blue" />
                  Layered Execution & Security Pipeline
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Zero-proxy request flow from Edge authentication through Server Actions to
                  Supabase PostgreSQL 17 RLS
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-accent-green border-accent-green/30 bg-accent-green/10"
              >
                Zero Boundary Violations
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
              {/* Tier 1 */}
              <div className="p-4 rounded-xl bg-bg-tertiary border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-blue font-semibold">
                    Tier 01 · Edge & Auth
                  </div>
                  <div className="text-sm font-semibold text-text-heading mt-1">
                    Next.js 16 Proxy & SSR Session
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    Validates HttpOnly PKCE cookies, enforces CSP nonces, and resolves employee role
                    + department claims.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>proxy.ts</span>
                  <Lock className="w-3.5 h-3.5 text-accent-green" />
                </div>
              </div>

              {/* Tier 2 */}
              <div className="p-4 rounded-xl bg-bg-tertiary border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-blue font-semibold">
                    Tier 02 · Presentation
                  </div>
                  <div className="text-sm font-semibold text-text-heading mt-1">
                    8 Core Operational Modules
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    Pure light-mode OKLCH UI (@repo/ui + @repo/theme) with React 19 transitions and
                    TanStack Query state sync.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>apps/portal</span>
                  <Building2 className="w-3.5 h-3.5 text-accent-blue" />
                </div>
              </div>

              {/* Tier 3 */}
              <div className="p-4 rounded-xl bg-bg-tertiary border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-blue font-semibold">
                    Tier 03 · Contract & RPC
                  </div>
                  <div className="text-sm font-semibold text-text-heading mt-1">
                    Server Actions + @repo/contract
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    Authenticate → Authorize → Validate via Zod (@repo/contract) → Rate-limit via
                    Redis → Invalidate cache tags.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>@repo/contract</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
                </div>
              </div>

              {/* Tier 4 */}
              <div className="p-4 rounded-xl bg-bg-tertiary border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-green font-semibold">
                    Tier 04 · Data Gateway
                  </div>
                  <div className="text-sm font-semibold text-text-heading mt-1">
                    @repo/supabase Primary & Replica
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    Routes analytical dashboard reads to createReadReplicaClient() and transactional
                    writes to primary PostgreSQL 17.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>@repo/supabase</span>
                  <Server className="w-3.5 h-3.5 text-accent-green" />
                </div>
              </div>

              {/* Tier 5 */}
              <div className="p-4 rounded-xl bg-bg-tertiary border border-border-subtle flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-amber font-semibold">
                    Tier 05 · Storage & Telemetry
                  </div>
                  <div className="text-sm font-semibold text-text-heading mt-1">
                    PostgreSQL 17 + Redis + SCADA
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    {GIT_PROVENANCE_METRICS.totalMigrations} migrations, {DATABASE_SCHEMA.length}{' '}
                    core tables, Hybrid L1/L2 Redis 7.4, FUXA Modbus/OPC-UA, and C66 gate hardware.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>@repo/database</span>
                  <Cpu className="w-3.5 h-3.5 text-accent-amber" />
                </div>
              </div>
            </div>
          </Card>

          {/* Visual Block-and-Line Example Backend Flow Diagrams */}
          <Card className="p-6" data-testid="visual-block-line-diagrams">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-semibold text-text-heading flex items-center gap-2">
                  <GitCommit className="w-4 h-4 text-accent-blue" />
                  Visual Block-and-Line Architecture & Cross-Department Data Flows
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  End-to-end block-and-line illustrations showing how field telemetry, shift
                  budgets, and badge credentials flow across backend services
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-accent-blue border-accent-blue/30 bg-accent-blue/10"
              >
                3 Live Inter-Department Pipelines
              </Badge>
            </div>

            <div className="space-y-6">
              {EXAMPLE_BACKEND_FLOW_PIPELINES.map((pipeline) => (
                <div
                  key={pipeline.id}
                  className="p-4 rounded-xl bg-bg-secondary/60 border border-border-subtle space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-text-heading">{pipeline.title}</h4>
                      <p className="text-xs text-text-secondary">{pipeline.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono w-fit">
                      {pipeline.badge}
                    </Badge>
                  </div>

                  {/* Connected Blocks & Directional Lines */}
                  <div className="grid grid-cols-1 lg:grid-cols-9 gap-2 items-center">
                    {pipeline.nodes.map((node, idx) => (
                      <div key={node.id} className="contents">
                        {/* Block Node */}
                        <div
                          className="lg:col-span-1 p-3 rounded-xl bg-white border-2 shadow-sm flex flex-col justify-between min-h-[148px] relative"
                          style={{ borderColor: `${node.color}55` }}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${node.color}18`,
                                  color: node.color,
                                }}
                              >
                                {node.step}
                              </span>
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: node.color }}
                              />
                            </div>
                            <div className="text-xs font-semibold text-text-heading mt-1.5 leading-snug">
                              {node.title}
                            </div>
                            <div className="text-[10px] font-mono text-text-muted mt-0.5">
                              {node.role}
                            </div>
                            <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
                              {node.detail}
                            </p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-border-subtle text-[9px] font-mono text-accent-blue truncate">
                            {node.protocol}
                          </div>
                        </div>

                        {/* Connecting Line + Arrow between blocks */}
                        {idx < pipeline.nodes.length - 1 && (
                          <div className="lg:col-span-1 flex lg:flex-col items-center justify-center py-1 lg:py-0">
                            <div className="hidden lg:flex items-center w-full">
                              <div
                                className="h-0.5 flex-1"
                                style={{
                                  background: `linear-gradient(90deg, ${node.color}, ${
                                    pipeline.nodes[idx + 1]?.color ?? node.color
                                  })`,
                                }}
                              />
                              <ArrowRight
                                className="w-4 h-4 -ml-1 shrink-0"
                                style={{ color: pipeline.nodes[idx + 1]?.color ?? node.color }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-bg-tertiary border border-border-subtle mt-1">
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-text-heading flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-green" />
                  Central Hub Routing Topology (8 / 8 Active Modules)
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Direct navigation and RBAC boundary mapping from Central Command (/hub) to all 8
                  operational modules
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {DEPARTMENTS.map((dept) => (
                <Card key={dept.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-1" style={{ backgroundColor: dept.color }} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-text-heading">
                        {dept.name}
                      </CardTitle>
                      <span className="text-[11px] font-mono text-text-muted">/{dept.slug}</span>
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {dept.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {dept.routes.slice(0, 4).map((r) => (
                        <span
                          key={r.path}
                          className="px-2 py-0.5 rounded bg-bg-tertiary text-[10px] font-mono text-text-secondary"
                        >
                          {r.name}
                        </span>
                      ))}
                      {dept.routes.length > 4 && (
                        <span className="px-2 py-0.5 rounded bg-bg-tertiary text-[10px] font-mono text-text-muted">
                          +{dept.routes.length - 4} more
                        </span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                      <span className="text-[10px] font-mono text-text-muted">
                        {dept.roles.length} RBAC roles
                      </span>
                      <Link
                        href={`/${dept.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline"
                      >
                        Open Module
                        <ArrowRight className="w-3 h-3" />
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
