import { Book } from '@repo/ui/components/ui/book';
import { Breadcrumb, BreadcrumbItem } from '@repo/ui/components/ui/breadcrumb';
import { ButtonLink } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileCode,
  Layers,
  Network,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Documentation & Runbooks | Arch Systems',
  description: 'Official system manuals, architecture references, and API specifications.',
};

const DOCUMENTATION_VOLUMES = [
  {
    id: 'system-architecture',
    title: 'Arch Architecture Manual',
    subtitle: 'Enterprise Topology',
    description:
      'Comprehensive system diagrams, Turborepo 2.x monorepo topology, Next.js 16 app router specifications, and reactive state trees.',
    variant: 'stripe' as const,
    color: '#006fee',
    textColor: '#ffffff',
    icon: <Network className="h-4 w-4" />,
    href: '/overview?tab=architecture',
    badge: 'Core Architecture',
  },
  {
    id: 'security-rls',
    title: 'Security & RLS Governance',
    subtitle: 'PostgreSQL & Auth',
    description:
      'Role-based row level security policies, multi-tenant isolation, audit log schemas, and crypto key rotation procedures.',
    variant: 'simple' as const,
    color: '#9D2127',
    textColor: '#ffffff',
    textured: true,
    icon: <ShieldCheck className="h-4 w-4" />,
    href: '/overview?tab=audit',
    badge: 'Security & Compliance',
  },
  {
    id: 'mining-dispatch',
    title: 'Operations & Dispatch Protocols',
    subtitle: 'Heavy Machinery',
    description:
      'Standard operating procedures for coal haul trucks, blast drills, RFID access gates, and shift handovers.',
    variant: 'simple' as const,
    color: '#FED954',
    textColor: '#9d3b05',
    textured: true,
    icon: <Layers className="h-4 w-4" />,
    href: '/overview?tab=departments',
    badge: 'Industrial Ops',
  },
  {
    id: 'api-specs',
    title: 'OpenAPI & Swagger Specification',
    subtitle: 'REST API Contracts',
    description:
      'Interactive Swagger UI API explorer detailing telemetry ingest, access badge verification, and SCADA endpoints.',
    variant: 'stripe' as const,
    color: '#059669',
    textColor: '#ffffff',
    icon: <FileCode className="h-4 w-4" />,
    href: '/docs/api',
    badge: 'API Reference',
  },
  {
    id: 'react-18-performance',
    title: 'React 19 & Next.js 16 Performance Guide',
    subtitle: 'RSC & Cache Components',
    description:
      'How React 19 Transitions, Suspense streaming, React Server Components, and Next.js 16 "use cache" profiles keep 12-hour SCADA dashboards responsive.',
    variant: 'stripe' as const,
    color: '#0ea5e9',
    textColor: '#ffffff',
    icon: <Layers className="h-4 w-4" />,
    href: '/docs/react-18-performance',
    badge: 'Frontend Performance',
  },
];

export default function DocsLandingPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 px-md py-10 sm:px-lg lg:px-xl">
      {/* Navigation Breadcrumbs (Geist Menu Type) */}
      <Breadcrumb type="menu">
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem href="/overview">Overview</BreadcrumbItem>
        <BreadcrumbItem active>Documentation Volumes</BreadcrumbItem>
      </Breadcrumb>

      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-6 border-[var(--border-default)] border-b pb-6 md:flex-row md:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-3 py-1 font-semibold text-accent-blue text-xs uppercase tracking-wider">
            <BookOpen className="h-3.5 w-3.5" />
            Official Arch Library
          </div>
          <h1 className="font-extrabold text-3xl text-[var(--text-heading)] tracking-tight sm:text-4xl">
            Documentation & System Manuals
          </h1>
          <p className="mt-2 max-w-3xl text-[var(--text-muted)] text-base">
            Explore authoritative operational manuals, architectural blueprints, compliance
            runbooks, and machine-to-machine API specifications.
          </p>
        </div>

        {/* Geist ButtonLink Actions */}
        <div className="flex shrink-0 items-center gap-3">
          <ButtonLink
            href="/docs/api"
            variant="default"
            size="small"
            prefix={<FileCode className="h-4 w-4" />}
          >
            Swagger API
          </ButtonLink>
          <ButtonLink
            href="/overview?tab=docs"
            variant="secondary"
            size="small"
            suffix={<ArrowRight className="h-4 w-4" />}
          >
            Codebase Maps
          </ButtonLink>
        </div>
      </div>

      {/* Bookshelf Volumes Grid */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {DOCUMENTATION_VOLUMES.map((vol) => (
          <GlassCard
            key={vol.id}
            className="group flex flex-col justify-between p-6 transition-all duration-300 hover:border-[var(--accent-blue)]/40"
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
              <div className="min-w-0 flex-1 space-y-2.5">
                <span className="inline-block font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                  {vol.badge}
                </span>
                <h3 className="line-clamp-2 font-bold text-[var(--text-heading)] text-base transition-colors group-hover:text-[var(--accent-blue)]">
                  {vol.title}
                </h3>
                <p className="line-clamp-3 text-[var(--text-muted)] text-xs leading-relaxed">
                  {vol.description}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-[var(--border-default)]/60 border-t pt-5">
              <span className="font-mono text-[var(--text-muted)] text-xs">{vol.subtitle}</span>
              <Link
                href={vol.href}
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-blue)] text-xs hover:underline"
              >
                Open Volume
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
