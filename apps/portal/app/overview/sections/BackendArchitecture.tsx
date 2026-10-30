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
  Cpu,
  Database,
  Globe,
  HardDrive,
  Lock,
  Network,
  Radio,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  BACKEND_CONNECTIONS,
  BACKEND_SERVICES,
  EXAMPLE_BACKEND_FLOW_PIPELINES,
  GIT_PROVENANCE_METRICS,
} from '../lib/data';

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  client: {
    label: 'Client & Edge Tier',
    icon: Globe,
    badgeClass: 'text-accent-green border-accent-green/30 bg-accent-green/10',
  },
  gateway: {
    label: 'RPC & Event Gateway',
    icon: Server,
    badgeClass: 'text-accent-blue border-accent-blue/30 bg-accent-blue/10',
  },
  database: {
    label: 'Supabase Data Platform',
    icon: Database,
    badgeClass: 'text-accent-green border-accent-green/30 bg-accent-green/10',
  },
  cache: {
    label: 'Hybrid L1/L2 Cache & Locks',
    icon: Zap,
    badgeClass: 'text-accent-amber border-accent-amber/30 bg-accent-amber/10',
  },
  iot: {
    label: 'Industrial SCADA & Hardware',
    icon: Cpu,
    badgeClass: 'text-accent-blue border-accent-blue/30 bg-accent-blue/10',
  },
  observability: {
    label: 'AI & APM Observability',
    icon: Activity,
    badgeClass: 'text-accent-amber border-accent-amber/30 bg-accent-amber/10',
  },
};

export default function BackendArchitecture() {
  const fuxaService = BACKEND_SERVICES.find((s) => s.id === 'fuxa-scada');

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 font-semibold text-2xl text-text-heading">
            <Server className="h-6 w-6 text-accent-blue" />
            Backend Service Mesh & Telemetry Topology
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {BACKEND_SERVICES.length} production backend services and {BACKEND_CONNECTIONS.length}{' '}
            authenticated data/telemetry pipelines
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-accent-green/30 bg-accent-green/10 font-mono text-accent-green text-xs"
          >
            PostgreSQL 17 · {GIT_PROVENANCE_METRICS.totalMigrations} Migrations
          </Badge>
          <Badge
            variant="outline"
            className="border-accent-blue/30 bg-accent-blue/10 font-mono text-accent-blue text-xs"
          >
            100% RLS InitPlan
          </Badge>
          <Badge
            variant="outline"
            className="border-accent-amber/30 bg-accent-amber/10 font-mono text-accent-amber text-xs"
          >
            Hybrid L1/L2 Redis 7.4
          </Badge>
        </div>
      </div>

      {/* Example Backend Block-and-Line Visual Topology Diagram */}
      <Card className="p-6" data-testid="backend-block-line-illustration">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-base text-text-heading">
              <Network className="h-4 w-4 text-accent-blue" />
              Example Backend Block-and-Line Connection Topology
            </h3>
            <p className="mt-0.5 text-text-secondary text-xs">
              Visual block-and-line diagram illustrating how Client, Edge RPC Gateway, Hybrid Redis,
              Supabase PostgreSQL 17, and Industrial IoT connect
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-accent-green/30 bg-accent-green/10 font-mono text-[10px] text-accent-green"
          >
            Zero-Proxy Direct RLS Architecture
          </Badge>
        </div>

        {/* 3-Column Connected Block & Line Architecture Canvas */}
        <div className="grid grid-cols-1 items-center gap-3 rounded-xl border border-border-subtle bg-bg-secondary/60 p-4 lg:grid-cols-5">
          {/* Column 1: Client & Industrial Edge */}
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-emerald-400/60 bg-white p-3 shadow-sm">
              <div className="font-bold font-mono text-[10px] text-emerald-700 uppercase">
                Client Tier
              </div>
              <div className="mt-0.5 font-semibold text-text-heading text-xs">
                Portal Web App (:3000)
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-muted">
                Next.js 16.4.3 · React 19
              </div>
            </div>
            <div className="rounded-xl border-2 border-sky-400/60 bg-white p-3 shadow-sm">
              <div className="font-bold font-mono text-[10px] text-sky-700 uppercase">
                Industrial IoT Tier
              </div>
              <div className="mt-0.5 font-semibold text-text-heading text-xs">
                FUXA SCADA & C66 Gate
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-muted">
                OPC-UA · Modbus · TCP 9100
              </div>
            </div>
          </div>

          {/* Line Connector 1 -> 2 */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="hidden w-full items-center lg:flex">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
              <ArrowRight className="-ml-1 h-4 w-4 text-blue-600" />
            </div>
            <span className="mt-1 rounded border border-border-subtle bg-white px-2 py-0.5 font-mono text-[10px] text-text-secondary">
              HTTPS / WSS / RPC
            </span>
          </div>

          {/* Column 2: Gateway & Orchestration */}
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-blue-500/70 bg-white p-3.5 shadow-sm">
              <div className="font-bold font-mono text-[10px] text-blue-700 uppercase">
                RPC Gateway
              </div>
              <div className="mt-0.5 font-semibold text-text-heading text-xs">
                Next.js Server Actions
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-muted">
                Auth → RBAC → @repo/contract Zod
              </div>
            </div>
            <div className="rounded-xl border-2 border-amber-400/70 bg-white p-3 shadow-sm">
              <div className="font-bold font-mono text-[10px] text-amber-700 uppercase">
                Async Event Bus
              </div>
              <div className="mt-0.5 font-semibold text-text-heading text-xs">
                Inngest Durable Workers
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-muted">
                Shift Rollups & Telemetry Sync
              </div>
            </div>
          </div>

          {/* Line Connector 2 -> 3 */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="hidden w-full items-center lg:flex">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-600 to-emerald-600" />
              <ArrowRight className="-ml-1 h-4 w-4 text-emerald-600" />
            </div>
            <span className="mt-1 rounded border border-border-subtle bg-white px-2 py-0.5 font-mono text-[10px] text-text-secondary">
              PgWire 5432 + RESP 6379
            </span>
          </div>

          {/* Column 3: Data, Cache & Observability */}
          <div className="space-y-2.5">
            <div className="rounded-xl border-2 border-emerald-500/70 bg-white p-3 shadow-sm">
              <div className="font-bold font-mono text-[10px] text-emerald-700 uppercase">
                Primary ACID Store
              </div>
              <div className="mt-0.5 font-semibold text-text-heading text-xs">
                Supabase PostgreSQL 17
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-muted">
                213 Migrations · 100% RLS InitPlan
              </div>
            </div>
            <div className="rounded-xl border-2 border-red-400/70 bg-white p-3 shadow-sm">
              <div className="font-bold font-mono text-[10px] text-red-700 uppercase">
                State & Mutex
              </div>
              <div className="mt-0.5 font-semibold text-text-heading text-xs">
                Hybrid L1/L2 Redis 7.4
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-muted">
                Sub-2ms LRU + Upstash Redlock
              </div>
            </div>
            <div className="rounded-xl border-2 border-purple-400/60 bg-white p-2.5 shadow-sm">
              <div className="font-bold font-mono text-[10px] text-purple-700 uppercase">
                Observability
              </div>
              <div className="font-semibold text-text-heading text-xs">
                Langfuse AI + Sentry OTel
              </div>
            </div>
          </div>
        </div>

        {/* Quick Summary of Example Pipelines */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {EXAMPLE_BACKEND_FLOW_PIPELINES.map((p) => (
            <div
              key={p.id}
              className="space-y-1.5 rounded-lg border border-border-subtle bg-bg-tertiary p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-text-heading">{p.title.split('·')[0]}</span>
                <span className="font-mono text-[10px] text-accent-blue">{p.badge}</span>
              </div>
              <p className="text-[11px] text-text-secondary">
                {p.nodes.map((n) => n.title).join(' ──► ')}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Backend Services Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {BACKEND_SERVICES.map((service) => {
          const meta = CATEGORY_META[service.category] ?? CATEGORY_META.gateway;
          const Icon = meta?.icon ?? Server;

          return (
            <Card key={service.id} className="flex flex-col justify-between overflow-hidden">
              <div>
                <div className="h-1" style={{ backgroundColor: service.color }} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-accent-blue" />
                      <CardTitle className="font-semibold text-base text-text-heading">
                        {service.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${meta?.badgeClass ?? ''}`}
                    >
                      {service.sla}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-text-muted text-xs">
                    {service.role} · {service.tech}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <p className="text-text-secondary text-xs leading-relaxed">
                    {service.description}
                  </p>

                  {/* Protocols & Security */}
                  <div className="space-y-1.5 rounded-lg bg-bg-tertiary p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-text-muted">Protocols:</span>
                      <span className="font-mono text-[11px] text-text-heading">
                        {service.protocols.join(' · ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 font-mono text-[11px] text-text-muted">
                        <Lock className="h-3 w-3 text-accent-green" />
                        Security:
                      </span>
                      <span className="max-w-[220px] truncate font-mono text-[11px] text-text-secondary">
                        {service.security}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5">
                    {service.features.map((feat) => (
                      <span
                        key={feat}
                        className="rounded border border-border-subtle bg-bg-secondary px-2 py-0.5 font-mono text-[10px] text-text-secondary"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Live SCADA Tag Stream Table */}
      {fuxaService?.scadaMetrics && (
        <Card className="overflow-hidden">
          <CardHeader className="border-border-subtle border-b bg-bg-secondary/40 pb-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="flex items-center gap-2 font-semibold text-base text-text-heading">
                  <Radio className="h-4 w-4 text-accent-green" />
                  Industrial SCADA & PLC Tag Registry (OPC-UA / Modbus-TCP)
                </CardTitle>
                <CardDescription className="text-xs">
                  {fuxaService.scadaMetrics.modbusRegisterCount} Modbus registers across{' '}
                  {fuxaService.scadaMetrics.modbusActiveNodes} active nodes ·{' '}
                  {fuxaService.scadaMetrics.opcUaPollingRateHz}Hz poll rate ·{' '}
                  {fuxaService.scadaMetrics.opcUaJitterMs}ms jitter
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-accent-green/30 bg-accent-green/10 font-mono text-[10px] text-accent-green"
              >
                0.0% Frame Loss
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-border-subtle border-b bg-bg-secondary/30 font-mono text-[11px] text-text-muted">
                  <th className="px-4 py-2.5">Tag ID</th>
                  <th className="px-4 py-2.5">Equipment</th>
                  <th className="px-4 py-2.5">Protocol</th>
                  <th className="px-4 py-2.5">Register / Node</th>
                  <th className="px-4 py-2.5">Nominal Value</th>
                  <th className="px-4 py-2.5">Rate</th>
                  <th className="px-4 py-2.5">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {fuxaService.scadaMetrics.tags.map((tag) => (
                  <tr key={tag.tagId} className="hover:bg-bg-tertiary/50">
                    <td className="px-4 py-2 font-mono font-semibold text-accent-blue">
                      {tag.tagId}
                    </td>
                    <td className="px-4 py-2 text-text-heading">{tag.equipment}</td>
                    <td className="px-4 py-2 font-mono text-text-secondary">
                      {tag.sourceProtocol}
                    </td>
                    <td className="px-4 py-2 font-mono text-text-muted">
                      {tag.registerAddress ?? tag.nodeId}
                    </td>
                    <td className="px-4 py-2 font-mono font-semibold text-text-heading">
                      {String(tag.baseValue)} {tag.unit ?? ''}
                    </td>
                    <td className="px-4 py-2 font-mono text-text-secondary">
                      {tag.pollingRateHz} Hz
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-accent-green/10 px-2 py-0.5 font-mono text-[10px] text-accent-green">
                        {tag.quality}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Authenticated Data & Telemetry Connections */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="flex items-center gap-2 font-semibold text-base text-text-heading">
            <ShieldCheck className="h-4 w-4 text-accent-blue" />
            Service-to-Service Connection Matrix ({BACKEND_CONNECTIONS.length} Channels)
          </h3>
          <p className="mt-0.5 text-text-secondary text-xs">
            Encrypted RPC, Postgres wire, Redis pipeline, and industrial telemetry channels
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {BACKEND_CONNECTIONS.map((conn) => (
            <div
              key={conn.id}
              className="flex flex-col justify-between gap-2 rounded-lg border border-border-subtle bg-bg-tertiary p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono font-semibold text-text-heading text-xs">
                  <span>{conn.source}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent-blue" />
                  <span>{conn.target}</span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {conn.protocol}
                </Badge>
              </div>
              <div className="font-medium text-accent-blue text-xs">{conn.label}</div>
              <p className="text-[11px] text-text-secondary">{conn.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
