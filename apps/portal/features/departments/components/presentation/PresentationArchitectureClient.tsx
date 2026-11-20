'use client';

import { Badge } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { ArrowUpRight, Database, Layers, Server, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { PresentationSnapshot } from './presentation-data';
import { PRESENTATION_MODULE_FLOWS } from './presentation-slides-data';

const ARCHITECTURE_LAYERS = [
  {
    layer: 'Edge & Security Proxy',
    stack: 'Next.js 16 proxy.ts + Per-Request Nonce CSP + Redis SSR Cache',
    detail: 'Validates JWT claims, enforces route RBAC, and hydrates permissions in < 150ms.',
    icon: ShieldCheck,
  },
  {
    layer: 'Interactive Operational UI',
    stack: 'React 19 RSC + Tailwind OKLCH + TanStack Query + IndexedDB Queue',
    detail: 'Zero-dark-mode glare-free cockpit usable across pit tablets, gates, and boardrooms.',
    icon: Layers,
  },
  {
    layer: 'Contracts & Realtime Bus',
    stack: '@repo/contract Zod 4 + Supabase Realtime CDC + Turborepo Policy',
    detail: 'Maintains static parity across SQL migrations, server actions, and live UI tables.',
    icon: Server,
  },
  {
    layer: 'Database & Analytical Store',
    stack: 'Supabase PostgreSQL 17 + Read Replicas + 100% RLS InitPlan',
    detail: 'Stores haulage, breakdowns, OTR tyres, plant sheets, and multi-month gate attendance.',
    icon: Database,
  },
] as const;

interface PresentationArchitectureClientProps {
  readonly snapshot: PresentationSnapshot;
}

export function PresentationArchitectureClient({ snapshot }: PresentationArchitectureClientProps) {
  return (
    <div className="space-y-6" data-testid="presentation-architecture-view">
      {/* Architecture Layers */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ARCHITECTURE_LAYERS.map((entry) => {
          const IconComponent = entry.icon;
          return (
            <GlassCard
              key={entry.layer}
              className="border border-[var(--border-default)] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono font-semibold text-[var(--accent-blue)] text-xs uppercase">
                    {entry.layer}
                  </span>
                  <h3 className="mt-1 font-semibold text-[var(--text-heading)] text-base">
                    {entry.stack}
                  </h3>
                </div>
                <span className="rounded-lg border border-accent-gold/40 bg-[var(--bg-secondary)] p-2 text-accent-gold">
                  <IconComponent className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-[var(--text-secondary)] text-sm">{entry.detail}</p>
            </GlassCard>
          );
        })}
      </div>

      {/* Connected Module Flow Explorer */}
      <GlassCard className="border border-[var(--border-default)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-subtle)] border-b pb-3">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-lg">
              Operational Module Flow &amp; Schema Persistence Map
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              {snapshot.totalDepartments} modules live · {snapshot.migrationsCount} migrations ·{' '}
              {snapshot.verificationGatesCount} verification gates
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/database/schemas"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-white"
            >
              <span>Visual ER Diagram</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/overview"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs hover:opacity-90"
            >
              <span>System Overview</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PRESENTATION_MODULE_FLOWS.map((node) => (
            <div
              key={node.slug}
              className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-4"
            >
              <div className="space-y-2">
                <Badge variant="blue" size="sm">
                  {node.stage}
                </Badge>
                <h4 className="font-semibold text-[var(--text-heading)] text-base">{node.name}</h4>
                <p className="text-[var(--text-secondary)] text-xs">{node.roleSummary}</p>
              </div>
              <div className="mt-3 space-y-2 border-[var(--border-subtle)] border-t pt-3">
                <p className="font-mono text-[11px] text-[var(--text-muted)]">
                  Tables: {node.tablesFed}
                </p>
                <Link
                  href={node.route}
                  className="inline-flex items-center gap-1 font-semibold text-[var(--accent-blue)] text-xs hover:underline"
                >
                  <span>Open {node.name}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
