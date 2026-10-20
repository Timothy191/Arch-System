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
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-heading flex items-center gap-2.5">
            <Server className="w-6 h-6 text-accent-blue" />
            Backend Service Mesh & Telemetry Topology
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            {BACKEND_SERVICES.length} production backend services and {BACKEND_CONNECTIONS.length}{' '}
            authenticated data/telemetry pipelines
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-mono text-accent-green border-accent-green/30 bg-accent-green/10"
          >
            PostgreSQL 17 · {GIT_PROVENANCE_METRICS.totalMigrations} Migrations
          </Badge>
          <Badge
            variant="outline"
            className="text-xs font-mono text-accent-blue border-accent-blue/30 bg-accent-blue/10"
          >
            100% RLS InitPlan
          </Badge>
          <Badge
            variant="outline"
            className="text-xs font-mono text-accent-amber border-accent-amber/30 bg-accent-amber/10"
          >
            Hybrid L1/L2 Redis 7.4
          </Badge>
        </div>
      </div>

      {/* Example Backend Block-and-Line Visual Topology Diagram */}
      <Card className="p-6" data-testid="backend-block-line-illustration">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base font-semibold text-text-heading flex items-center gap-2">
              <Network className="w-4 h-4 text-accent-blue" />
              Example Backend Block-and-Line Connection Topology
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Visual block-and-line diagram illustrating how Client, Edge RPC Gateway, Hybrid Redis,
              Supabase PostgreSQL 17, and Industrial IoT connect
            </p>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-mono text-accent-green border-accent-green/30 bg-accent-green/10"
          >
            Zero-Proxy Direct RLS Architecture
          </Badge>
        </div>

        {/* 3-Column Connected Block & Line Architecture Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-center p-4 rounded-xl bg-bg-secondary/60 border border-border-subtle">
          {/* Column 1: Client & Industrial Edge */}
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-white border-2 border-emerald-400/60 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-emerald-700 uppercase">
                Client Tier
              </div>
              <div className="text-xs font-semibold text-text-heading mt-0.5">
                Portal Web App (:3000)
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">
                Next.js 16.3.8 · React 19
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border-2 border-sky-400/60 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-sky-700 uppercase">
                Industrial IoT Tier
              </div>
              <div className="text-xs font-semibold text-text-heading mt-0.5">
                FUXA SCADA & C66 Gate
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">
                OPC-UA · Modbus · TCP 9100
              </div>
            </div>
          </div>

          {/* Line Connector 1 -> 2 */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="hidden lg:flex items-center w-full">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
              <ArrowRight className="w-4 h-4 text-blue-600 -ml-1" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-border-subtle text-text-secondary mt-1">
              HTTPS / WSS / RPC
            </span>
          </div>

          {/* Column 2: Gateway & Orchestration */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-white border-2 border-blue-500/70 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-blue-700 uppercase">
                RPC Gateway
              </div>
              <div className="text-xs font-semibold text-text-heading mt-0.5">
                Next.js Server Actions
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">
                Auth → RBAC → @repo/contract Zod
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border-2 border-amber-400/70 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-amber-700 uppercase">
                Async Event Bus
              </div>
              <div className="text-xs font-semibold text-text-heading mt-0.5">
                Inngest Durable Workers
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">
                Shift Rollups & Telemetry Sync
              </div>
            </div>
          </div>

          {/* Line Connector 2 -> 3 */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="hidden lg:flex items-center w-full">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-600 to-emerald-600" />
              <ArrowRight className="w-4 h-4 text-emerald-600 -ml-1" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-border-subtle text-text-secondary mt-1">
              PgWire 5432 + RESP 6379
            </span>
          </div>

          {/* Column 3: Data, Cache & Observability */}
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-white border-2 border-emerald-500/70 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-emerald-700 uppercase">
                Primary ACID Store
              </div>
              <div className="text-xs font-semibold text-text-heading mt-0.5">
                Supabase PostgreSQL 17
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">
                189 Migrations · 100% RLS InitPlan
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border-2 border-red-400/70 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-red-700 uppercase">
                State & Mutex
              </div>
              <div className="text-xs font-semibold text-text-heading mt-0.5">
                Hybrid L1/L2 Redis 7.4
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">
                Sub-2ms LRU + Upstash Redlock
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-white border-2 border-purple-400/60 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-purple-700 uppercase">
                Observability
              </div>
              <div className="text-xs font-semibold text-text-heading">
                Langfuse AI + Sentry OTel
              </div>
            </div>
          </div>
        </div>

        {/* Quick Summary of Example Pipelines */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {EXAMPLE_BACKEND_FLOW_PIPELINES.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-lg bg-bg-tertiary border border-border-subtle text-xs space-y-1.5"
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {BACKEND_SERVICES.map((service) => {
          const meta = CATEGORY_META[service.category] ?? CATEGORY_META.gateway;
          const Icon = meta?.icon ?? Server;

          return (
            <Card key={service.id} className="overflow-hidden flex flex-col justify-between">
              <div>
                <div className="h-1" style={{ backgroundColor: service.color }} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-accent-blue shrink-0" />
                      <CardTitle className="text-base font-semibold text-text-heading">
                        {service.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${meta?.badgeClass ?? ''}`}
                    >
                      {service.sla}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs font-mono text-text-muted">
                    {service.role} · {service.tech}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {service.description}
                  </p>

                  {/* Protocols & Security */}
                  <div className="p-2.5 rounded-lg bg-bg-tertiary space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-muted font-mono text-[11px]">Protocols:</span>
                      <span className="font-mono text-text-heading text-[11px]">
                        {service.protocols.join(' · ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-muted font-mono text-[11px] flex items-center gap-1">
                        <Lock className="w-3 h-3 text-accent-green" />
                        Security:
                      </span>
                      <span className="font-mono text-text-secondary text-[11px] truncate max-w-[220px]">
                        {service.security}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5">
                    {service.features.map((feat) => (
                      <span
                        key={feat}
                        className="px-2 py-0.5 rounded bg-bg-secondary border border-border-subtle text-[10px] font-mono text-text-secondary"
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
          <CardHeader className="pb-3 border-b border-border-subtle bg-bg-secondary/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold text-text-heading flex items-center gap-2">
                  <Radio className="w-4 h-4 text-accent-green" />
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
                className="text-[10px] font-mono text-accent-green border-accent-green/30 bg-accent-green/10"
              >
                0.0% Frame Loss
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-secondary/30 text-text-muted font-mono text-[11px]">
                  <th className="py-2.5 px-4">Tag ID</th>
                  <th className="py-2.5 px-4">Equipment</th>
                  <th className="py-2.5 px-4">Protocol</th>
                  <th className="py-2.5 px-4">Register / Node</th>
                  <th className="py-2.5 px-4">Nominal Value</th>
                  <th className="py-2.5 px-4">Rate</th>
                  <th className="py-2.5 px-4">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {fuxaService.scadaMetrics.tags.map((tag) => (
                  <tr key={tag.tagId} className="hover:bg-bg-tertiary/50">
                    <td className="py-2 px-4 font-mono font-semibold text-accent-blue">
                      {tag.tagId}
                    </td>
                    <td className="py-2 px-4 text-text-heading">{tag.equipment}</td>
                    <td className="py-2 px-4 font-mono text-text-secondary">
                      {tag.sourceProtocol}
                    </td>
                    <td className="py-2 px-4 font-mono text-text-muted">
                      {tag.registerAddress ?? tag.nodeId}
                    </td>
                    <td className="py-2 px-4 font-mono font-semibold text-text-heading">
                      {String(tag.baseValue)} {tag.unit ?? ''}
                    </td>
                    <td className="py-2 px-4 font-mono text-text-secondary">
                      {tag.pollingRateHz} Hz
                    </td>
                    <td className="py-2 px-4">
                      <span className="px-2 py-0.5 rounded bg-accent-green/10 text-accent-green font-mono text-[10px]">
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
          <h3 className="text-base font-semibold text-text-heading flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent-blue" />
            Service-to-Service Connection Matrix ({BACKEND_CONNECTIONS.length} Channels)
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Encrypted RPC, Postgres wire, Redis pipeline, and industrial telemetry channels
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BACKEND_CONNECTIONS.map((conn) => (
            <div
              key={conn.id}
              className="p-3.5 rounded-lg bg-bg-tertiary border border-border-subtle flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-xs font-semibold text-text-heading">
                  <span>{conn.source}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-accent-blue shrink-0" />
                  <span>{conn.target}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {conn.protocol}
                </Badge>
              </div>
              <div className="text-xs font-medium text-accent-blue">{conn.label}</div>
              <p className="text-[11px] text-text-secondary">{conn.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
