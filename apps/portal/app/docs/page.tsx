import { Book } from "@repo/ui/components/ui/book";
import { Breadcrumb, BreadcrumbItem } from "@repo/ui/components/ui/breadcrumb";
import { Browser } from "@repo/ui/components/ui/browser";
import { ButtonLink } from "@repo/ui/components/ui/button";
import { CodeBlock } from "@repo/ui/components/ui/code-block";
import { Collapse, CollapseGroup } from "@repo/ui/components/ui/collapse";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  ArrowRight,
  BookOpen,
  Bot,
  ExternalLink,
  FileCode,
  Layers,
  Network,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Documentation & Runbooks | Arch Systems",
  description: "Official system manuals, security architecture, and operational runbooks.",
};

const DOCUMENTATION_VOLUMES = [
  {
    id: "system-architecture",
    title: "Arch Architecture Manual",
    subtitle: "Enterprise Topology",
    description:
      "Comprehensive system diagrams, Turborepo 2.x monorepo topology, Next.js 16 app router specifications, and reactive state trees.",
    variant: "stripe" as const,
    color: "#006fee",
    textColor: "#ffffff",
    icon: <Network className="w-4 h-4" />,
    href: "/overview?tab=architecture",
    badge: "Core Architecture",
  },
  {
    id: "security-rls",
    title: "Security & RLS Governance",
    subtitle: "PostgreSQL & Auth",
    description:
      "Role-based row level security policies, multi-tenant isolation, audit log schemas, and crypto key rotation procedures.",
    variant: "simple" as const,
    color: "#9D2127",
    textColor: "#ffffff",
    textured: true,
    icon: <ShieldCheck className="w-4 h-4" />,
    href: "/overview?tab=audit",
    badge: "Security & Compliance",
  },
  {
    id: "multi-agent",
    title: "Multi-Agent Specialist Handbook",
    subtitle: "Autonomous Agents",
    description:
      "Operational mandates for the 8 specialist agent mesh: Antigravity, Claude, Codex, Gemini, Grok, Cline, Pi, and Goose.",
    variant: "stripe" as const,
    color: "#7DC1C1",
    textColor: "#ffffff",
    icon: <Bot className="w-4 h-4" />,
    href: "/overview?tab=agentic",
    badge: "Agent Mesh",
  },
  {
    id: "mining-dispatch",
    title: "Operations & Dispatch Protocols",
    subtitle: "Heavy Machinery",
    description:
      "Standard operating procedures for coal haul trucks, blast drills, RFID access gates, and shift handovers.",
    variant: "simple" as const,
    color: "#FED954",
    textColor: "#9d3b05",
    textured: true,
    icon: <Layers className="w-4 h-4" />,
    href: "/overview?tab=departments",
    badge: "Industrial Ops",
  },
  {
    id: "api-specs",
    title: "OpenAPI & Swagger Specification",
    subtitle: "REST API Contracts",
    description:
      "Interactive Swagger UI API explorer detailing telemetry ingest, access badge verification, and SCADA endpoints.",
    variant: "stripe" as const,
    color: "#059669",
    textColor: "#ffffff",
    icon: <FileCode className="w-4 h-4" />,
    href: "/docs/api",
    badge: "API Reference",
  },
];

const TELEMETRY_CODE_EXAMPLE = `import { ArchTelemetryClient } from "@arch/telemetry-sdk";

// Initialize SCADA Telemetry Gateway Client
const client = new ArchTelemetryClient({
  endpoint: process.env.ARCH_TELEMETRY_URL,
  apiKey: process.env.ARCH_INGEST_KEY,
});

// Record machine load measurement
await client.recordMetric({
  machineId: "HAUL-TRUCK-08",
  metric: "payload_tonnes",
  value: 248.5,
  timestamp: new Date().toISOString(),
});`;

export default function DocsLandingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Navigation Breadcrumbs (Geist Menu Type) */}
      <Breadcrumb type="menu">
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem href="/overview">Overview</BreadcrumbItem>
        <BreadcrumbItem active>Documentation Volumes</BreadcrumbItem>
      </Breadcrumb>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[var(--border-default)]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs font-semibold uppercase tracking-wider mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            Official Arch Library
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-heading)] sm:text-4xl">
            Documentation & System Manuals
          </h1>
          <p className="mt-2 text-base text-[var(--text-muted)] max-w-3xl">
            Explore authoritative operational manuals, architectural blueprints, compliance
            runbooks, and machine-to-machine API specifications.
          </p>
        </div>

        {/* Geist ButtonLink Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <ButtonLink
            href="/docs/api"
            variant="default"
            size="small"
            prefix={<FileCode className="w-4 h-4" />}
          >
            Swagger API
          </ButtonLink>
          <ButtonLink
            href="/overview?tab=docs"
            variant="secondary"
            size="small"
            suffix={<ArrowRight className="w-4 h-4" />}
          >
            Codebase Maps
          </ButtonLink>
        </div>
      </div>

      {/* Bookshelf Volumes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {DOCUMENTATION_VOLUMES.map((vol) => (
          <GlassCard
            key={vol.id}
            className="p-6 flex flex-col justify-between hover:border-[var(--accent-blue)]/40 transition-all duration-300 group"
          >
            <div className="flex items-start gap-6">
              {/* Responsive Book Cover */}
              <div className="shrink-0 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-1">
                <Book
                  title={vol.title}
                  subtitle={vol.subtitle}
                  variant={vol.variant}
                  color={vol.color}
                  textColor={vol.textColor}
                  icon={vol.icon}
                  textured={vol.textured}
                  width={{ default: 140, sm: 150 }}
                />
              </div>

              {/* Volume Details */}
              <div className="space-y-2.5 flex-1 min-w-0">
                <span className="inline-block text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  {vol.badge}
                </span>
                <h3 className="text-base font-bold text-[var(--text-heading)] group-hover:text-[var(--accent-blue)] transition-colors line-clamp-2">
                  {vol.title}
                </h3>
                <p className="text-xs text-[var(--text-muted)] line-clamp-3 leading-relaxed">
                  {vol.description}
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-[var(--border-default)]/60 flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-mono">{vol.subtitle}</span>
              <Link
                href={vol.href}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-blue)] hover:underline"
              >
                Open Volume
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Code Snippet Example with Geist CodeBlock */}
      <div className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-heading)]">
            Telemetry Client Ingestion API
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Publish SCADA sensor measurements directly to the Arch edge telemetry gateway.
          </p>
        </div>

        <CodeBlock
          filename="ingest-telemetry.ts"
          language="typescript"
          highlightedLinesNumbers={[4, 5]}
        >
          {TELEMETRY_CODE_EXAMPLE}
        </CodeBlock>
      </div>

      {/* Operational Runbooks Disclosure with Geist Collapse */}
      <div className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-heading)]">
            Frequently Referenced Operational Runbooks
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Standard emergency response procedures, cryptographic credential rotation, and shift
            protocols.
          </p>
        </div>

        <GlassCard className="p-6">
          <CollapseGroup multiple>
            <Collapse defaultExpanded title="Emergency SCADA Failover Procedure">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                In the event of an edge telemetry connection interruption exceeding 90 seconds, the
                local gateway buffers all PLC tag events in memory. Standby Redis clusters
                automatically initiate replica promotion within 450ms.
              </p>
            </Collapse>
            <Collapse title="Cryptographic Access Card Key Rotation">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                RFID credentials and QR badges are signed with rotating SHA-256 HMAC tokens. Access
                keys expire every 24 hours and can be manually refreshed from the Access Control
                Credential Manager.
              </p>
            </Collapse>
            <Collapse title="Multi-Agent Mesh Coordinator Handover">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                When transferring supervisory control between agents (e.g., Antigravity to Claude),
                ensure all active background workers have concluded transactions before
                synchronizing state trees.
              </p>
            </Collapse>
          </CollapseGroup>
        </GlassCard>
      </div>

      {/* Live Operations Portal Preview inside Geist Browser Chrome */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-heading)]">
              Live Operations Interface
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time telemetry and supervisory control visualizer running across the pit.
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--accent-green)] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            ● SCADA Engine Active
          </span>
        </div>

        <Browser address="https://arch.coal/operations/live" className="max-w-5xl shadow-2xl">
          <div className="p-8 bg-neutral-900 text-white min-h-[220px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
                  Telemetry Stream · Opencast Mine Sector 7
                </span>
              </div>
              <span className="font-mono text-xs text-neutral-500">12 Active Vehicles</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
              <div className="p-4 rounded-lg bg-neutral-800/80 border border-neutral-700/60">
                <span className="text-xs text-neutral-400 block font-mono">Haul Fleet Output</span>
                <span className="text-2xl font-bold text-white mt-1 block">4,280 t/h</span>
              </div>
              <div className="p-4 rounded-lg bg-neutral-800/80 border border-neutral-700/60">
                <span className="text-xs text-neutral-400 block font-mono">Blast Hole Drills</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                  98.4% Nominal
                </span>
              </div>
              <div className="p-4 rounded-lg bg-neutral-800/80 border border-neutral-700/60">
                <span className="text-xs text-neutral-400 block font-mono">
                  RFID Gate Verifications
                </span>
                <span className="text-2xl font-bold text-blue-400 mt-1 block">342 Today</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800 pt-3">
              <span>Arch Industrial OS v2.4</span>
              <Link href="/overview" className="text-blue-400 hover:underline">
                Explore Full Topology &rarr;
              </Link>
            </div>
          </div>
        </Browser>
      </div>
    </div>
  );
}
