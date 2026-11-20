'use client';

import { Badge } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  Layers,
  Presentation,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PresentationArchitectureClient } from './PresentationArchitectureClient';
import { PresentationDeckClient } from './PresentationDeckClient';
import { PresentationDocsClient } from './PresentationDocsClient';
import type { PresentationSnapshot } from './presentation-data';
import { downloadInvestorPresentationPdf } from './presentation-pdf-export';
import { buildExecutivePresentationSlides } from './presentation-slides-data';

export type PresentationWorkspaceMode = 'deck' | 'documentation' | 'architecture' | 'investor-pack';

interface PresentationWorkspaceClientProps {
  readonly mode: PresentationWorkspaceMode;
  readonly snapshot: PresentationSnapshot;
}

const MODE_NAV_ITEMS: readonly {
  readonly mode: PresentationWorkspaceMode;
  readonly href: string;
  readonly label: string;
  readonly icon: typeof Presentation;
}[] = [
  { mode: 'deck', href: '/presentation', label: 'Presentation Deck', icon: Presentation },
  {
    mode: 'documentation',
    href: '/presentation/documentation',
    label: 'System Documentation',
    icon: BookOpen,
  },
  {
    mode: 'architecture',
    href: '/presentation/architecture',
    label: 'Architecture & Modules',
    icon: Layers,
  },
  {
    mode: 'investor-pack',
    href: '/presentation/investor-pack',
    label: 'Investor Pack & PDF',
    icon: FileText,
  },
];

const NAV_PILL_BASE =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold text-xs transition-colors';

function buildInvestorBriefText(snapshot: PresentationSnapshot): string {
  const formattedDate = new Date(snapshot.generatedAtIso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });
  return [
    `*Arch-System (Arch OS) — Executive & Investor Briefing (${formattedDate})*`,
    `• Integrated Mining Modules: ${snapshot.totalDepartments}`,
    `• Fleet Availability: ${snapshot.fleetAvailabilityPct.toFixed(1)}% (${snapshot.activeMachines}/${snapshot.totalMachines} active machines)`,
    `• Breakdowns Resolved (24h): ${snapshot.resolvedBreakdowns24h} (${snapshot.activeBreakdowns} active workshop queue)`,
    `• Tracked Tyres: ${snapshot.totalTires} total (${snapshot.installedTires} mounted active)`,
    `• 30-Day Activity: ${snapshot.dailyLogsLast30d} daily logs · ${snapshot.accessEventsLast30d} gate access events`,
    `• Governance: ${snapshot.rlsCoveragePct}% PostgreSQL RLS · ${snapshot.migrationsCount} migrations · ${snapshot.verificationGatesCount} QA verification gates`,
  ].join('\n');
}

function InvestorPackSection({ snapshot }: { readonly snapshot: PresentationSnapshot }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const slides = buildExecutivePresentationSlides(snapshot);
  const executiveSummaryText = buildInvestorBriefText(snapshot);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await downloadInvestorPresentationPdf(snapshot);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(executiveSummaryText);
      setIsCopied(true);
      toast.success('Copied executive briefing summary');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  return (
    <div className="space-y-6" data-testid="presentation-investor-pack-view">
      <GlassCard className="border border-[var(--border-default)] bg-white p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Badge variant="amber-subtle" size="sm">
              Boardroom Deliverable
            </Badge>
            <h3 className="mt-2 font-bold text-[var(--text-heading)] text-xl">
              Executive &amp; Investor Briefing Pack (Landscape A4 PDF)
            </h3>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Exports all 12 slides, live site telemetry metrics, and the 6-stage pit-to-plant data
              architecture into an offline-ready PDF dossier.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyBrief}
              className="gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3.5 py-2 font-semibold text-[var(--text-heading)] text-xs hover:bg-white"
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-accent-green" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{isCopied ? 'Copied!' : 'Copy Exec Summary'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3.5 py-2 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              data-testid="download-investor-pdf-btn"
              className="gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-white text-xs shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isGenerating ? 'Generating PDF...' : 'Download Investor PDF'}</span>
            </button>
          </div>
        </div>

        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/70 p-4 font-mono text-[var(--text-heading)] text-xs leading-relaxed">
          {executiveSummaryText}
        </pre>
      </GlassCard>

      <GlassCard className="border border-[var(--border-default)] bg-white p-5">
        <h4 className="font-semibold text-[var(--text-heading)] text-base">
          Included 12-Slide Outline Preview
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3"
            >
              <span className="font-mono font-semibold text-[11px] text-[var(--accent-blue)]">
                Slide {String(slide.slideNumber).padStart(2, '0')} · {slide.chapter}
              </span>
              <p className="mt-1 font-semibold text-[var(--text-heading)] text-xs">{slide.title}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {slide.headlineMetric.label}: {slide.headlineMetric.value}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export function PresentationWorkspaceClient({ mode, snapshot }: PresentationWorkspaceClientProps) {
  return (
    <div className="space-y-6" data-testid="presentation-workspace-shell">
      <GlassCard className="border border-[var(--border-default)] bg-white/95 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-gold/50 bg-[var(--bg-secondary)]">
              <Logo variant="gold" className="h-6 w-6 text-accent-gold" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                  Arch-System Executive Presentation
                </h2>
                <Badge variant={snapshot.isLiveTelemetry ? 'green' : 'amber-subtle'} size="sm">
                  {snapshot.isLiveTelemetry ? 'Live Complex Telemetry' : 'Investor Briefing Ready'}
                </Badge>
              </div>
              <p className="mt-1 text-[var(--text-secondary)] text-sm">
                Prebuilt CEO &amp; investor briefing deck, live platform KPIs, and authoritative
                system documentation.
              </p>
            </div>
          </div>

          <nav aria-label="Presentation views" className="flex flex-wrap items-center gap-2">
            {MODE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = mode === item.mode;
              return (
                <Link
                  key={item.mode}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    NAV_PILL_BASE,
                    isActive
                      ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white shadow-xs'
                      : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] hover:bg-white'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </GlassCard>

      {mode === 'deck' && <PresentationDeckClient snapshot={snapshot} />}
      {mode === 'documentation' && <PresentationDocsClient />}
      {mode === 'architecture' && <PresentationArchitectureClient snapshot={snapshot} />}
      {mode === 'investor-pack' && <InvestorPackSection snapshot={snapshot} />}
    </div>
  );
}
