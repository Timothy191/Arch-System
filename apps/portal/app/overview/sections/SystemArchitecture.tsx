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
  Cpu,
  Database,
  Layers,
  Lock,
  Network,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { BACKEND_SERVICES, DATABASE_SCHEMA, DEPARTMENTS } from '../lib/data';

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
    subtitle: '186 Versioned Migrations',
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
  const totalRoutes = DEPARTMENTS.reduce((sum, d) => sum + d.routes.length, 0);

  return (
    <div className="p-6 space-y-8">
      {/* Top Header & KPI Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-heading flex items-center gap-2.5">
            <Network className="w-6 h-6 text-accent-blue" />
            End-to-End System Architecture Topology
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            Multi-tier industrial architecture connecting 8 Core Operational Modules to Supabase
            PostgreSQL 17, Hybrid Redis 7.4, and real-time SCADA telemetry
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="px-3.5 py-2 rounded-lg bg-bg-secondary border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Core Modules
            </div>
            <div className="text-lg font-bold text-text-heading">{DEPARTMENTS.length} / 8</div>
          </div>
          <div className="px-3.5 py-2 rounded-lg bg-bg-secondary border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Active Routes
            </div>
            <div className="text-lg font-bold text-accent-blue">{totalRoutes}</div>
          </div>
          <div className="px-3.5 py-2 rounded-lg bg-bg-secondary border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              DB Migrations
            </div>
            <div className="text-lg font-bold text-accent-green">186</div>
          </div>
          <div className="px-3.5 py-2 rounded-lg bg-bg-secondary border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Backend Nodes
            </div>
            <div className="text-lg font-bold text-text-heading">{BACKEND_SERVICES.length}</div>
          </div>
        </div>
      </div>

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
                <CardDescription className="text-xs font-mono">{pillar.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-text-secondary leading-relaxed">{pillar.description}</p>
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
              Zero-proxy request flow from Edge authentication through Server Actions to Supabase
              PostgreSQL 17 RLS
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
                Validates HttpOnly PKCE cookies, enforces CSP nonces, and resolves employee role +
                department claims.
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
                Authenticate → Authorize → Validate via Zod (@repo/contract) → Rate-limit via Redis
                → Invalidate cache tags.
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
                186 migrations, {DATABASE_SCHEMA.length} core tables, Hybrid L1/L2 Redis 7.4, FUXA
                Modbus/OPC-UA, and C66 gate hardware.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-muted">
              <span>@repo/database</span>
              <Cpu className="w-3.5 h-3.5 text-accent-amber" />
            </div>
          </div>
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
  );
}
