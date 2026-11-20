'use client';

import { Badge } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Pause,
  Play,
  Presentation,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PresentationSnapshot } from './presentation-data';
import { downloadInvestorPresentationPdf } from './presentation-pdf-export';
import {
  buildExecutivePresentationSlides,
  PRESENTATION_MODULE_FLOWS,
  type PresentationSlide,
} from './presentation-slides-data';

const CONTROL_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-45';

const PRIMARY_ACTION_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-1.5 font-semibold text-white text-xs shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50';

const RAIL_CARD_BASE =
  'w-full cursor-pointer rounded-xl border p-3 text-left transition-all duration-150';

const AUTO_ADVANCE_MS = 8000;
const KEY_SPACE = ' ';

interface PresentationDeckClientProps {
  readonly snapshot: PresentationSnapshot;
}

function SlideVisualStage({
  slide,
  snapshot,
}: {
  readonly slide: PresentationSlide;
  readonly snapshot: PresentationSnapshot;
}) {
  const chartData = useMemo(
    () => [
      { metric: 'Availability %', value: Math.round(snapshot.fleetAvailabilityPct) },
      { metric: 'RLS Coverage %', value: snapshot.rlsCoveragePct },
      { metric: 'Modules Live', value: snapshot.totalDepartments },
      { metric: '24h Resolved', value: snapshot.resolvedBreakdowns24h },
      { metric: 'CI Gates', value: snapshot.verificationGatesCount },
    ],
    [snapshot]
  );

  if (slide.visualType === 'kpi-chart') {
    return (
      <div
        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/70 p-4"
        data-testid="presentation-slide-chart"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
            Live Complex Telemetry Snapshot
          </span>
          <Badge variant="green" size="sm">
            {snapshot.isLiveTelemetry ? 'Live Supabase Feed' : 'Baseline Ready'}
          </Badge>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--border-default)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--border-default)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-default)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="value"
                name="Platform Metric"
                fill="var(--accent-blue)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (slide.visualType === 'value-chain' || slide.visualType === 'roadmap') {
    return (
      <div
        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/70 p-4"
        data-testid="presentation-value-chain"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
            Connected Pit-to-Plant Operating Chain
          </span>
          <span className="font-mono text-[11px] text-[var(--accent-blue)]">6 Synced Stages</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESENTATION_MODULE_FLOWS.map((node) => (
            <Link
              key={node.slug}
              href={node.route}
              className="rounded-lg border border-[var(--border-default)] bg-white p-2.5 transition-colors hover:border-[var(--accent-blue)]"
            >
              <span className="block font-mono text-[10px] text-[var(--accent-blue)] uppercase">
                {node.stage}
              </span>
              <span className="mt-0.5 block font-semibold text-[var(--text-heading)] text-xs">
                {node.name}
              </span>
              <span className="mt-1 line-clamp-2 block text-[11px] text-[var(--text-muted)]">
                {node.roleSummary}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/70 p-4"
      data-testid="presentation-architecture-visual"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
          Arch-System Platform Pillared Assurance
        </span>
        <ShieldCheck className="h-4 w-4 text-accent-green" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {slide.secondaryMetrics.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-[var(--border-default)] bg-white p-3"
          >
            <p className="font-medium text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              {item.label}
            </p>
            <p className="mt-1 font-bold text-[var(--text-heading)] text-lg">{item.value}</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PresentationDeckClient({ snapshot }: PresentationDeckClientProps) {
  const slides = useMemo(() => buildExecutivePresentationSlides(snapshot), [snapshot]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(true);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const totalSlides = slides.length;
  const activeSlide = slides[activeIndex] ?? slides[0]!;

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1 < totalSlides ? prev + 1 : 0));
  }, [totalSlides]);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  }, [totalSlides]);

  const handleToggleFullscreen = useCallback(async () => {
    const stageElement = stageRef.current;
    if (typeof document === 'undefined' || !stageElement) {
      setIsFullscreen((prev) => !prev);
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      } else if (typeof stageElement.requestFullscreen === 'function') {
        await stageElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    if (!isAutoPlay) return undefined;
    const timer = setInterval(() => {
      goToNext();
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [isAutoPlay, goToNext]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (event.key === 'ArrowRight' || event.key === KEY_SPACE) {
        event.preventDefault();
        goToNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrev();
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(totalSlides - 1);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        void handleToggleFullscreen();
      } else if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, handleToggleFullscreen, isFullscreen, totalSlides]);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadInvestorPresentationPdf(snapshot);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="presentation-deck-workspace">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-white/90 px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-gold/45 bg-[var(--bg-secondary)]">
            <Presentation className="h-4 w-4 text-accent-gold" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-[var(--text-heading)] text-sm">
              CEO &amp; Investor Live Slide Deck
            </p>
            <p className="text-[var(--text-muted)] text-xs">
              Slide {String(activeSlide.slideNumber).padStart(2, '0')} of {totalSlides} · Use ← / →
              keys or click any chapter
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSpeakerNotes((prev) => !prev)}
            className={CONTROL_BTN_CLASS}
            aria-pressed={showSpeakerNotes}
          >
            <MessageSquareText className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            <span>{showSpeakerNotes ? 'Hide Notes' : 'Speaker Notes'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAutoPlay((prev) => !prev)}
            className={CONTROL_BTN_CLASS}
            aria-pressed={isAutoPlay}
          >
            {isAutoPlay ? (
              <Pause className="h-3.5 w-3.5 text-accent-amber" />
            ) : (
              <Play className="h-3.5 w-3.5 text-accent-green" />
            )}
            <span>{isAutoPlay ? 'Pause Tour' : 'Auto Tour'}</span>
          </button>

          <button type="button" onClick={handleToggleFullscreen} className={CONTROL_BTN_CLASS}>
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className={PRIMARY_ACTION_BTN_CLASS}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Investor PDF'}</span>
          </button>
        </div>
      </div>

      {/* Main Boardroom Layout: Outline Rail + 16:9 Stage */}
      <div
        ref={stageRef}
        className={cn(
          'grid grid-cols-1 gap-5 lg:grid-cols-12',
          isFullscreen && 'fixed inset-0 z-50 overflow-y-auto bg-[var(--bg-primary)] p-6'
        )}
      >
        {/* Outline Rail */}
        <aside
          aria-label="Presentation slides outline"
          className="max-h-[640px] space-y-2 overflow-y-auto pr-1 lg:col-span-4 xl:col-span-3"
        >
          {slides.map((slide, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  RAIL_CARD_BASE,
                  isActive
                    ? 'border-[var(--accent-blue)] bg-white shadow-sm ring-1 ring-[var(--accent-blue)]/25'
                    : 'border-[var(--border-subtle)] bg-white/75 hover:border-[var(--border-default)] hover:bg-white'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-[11px] text-[var(--accent-blue)]">
                    {String(slide.slideNumber).padStart(2, '0')} / {totalSlides}
                  </span>
                  <span className="truncate text-[10px] text-[var(--text-muted)] uppercase">
                    {slide.chapter}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 font-semibold text-[var(--text-heading)] text-xs">
                  {slide.title}
                </p>
              </button>
            );
          })}
        </aside>

        {/* Active 16:9 Presentation Stage */}
        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          <GlassCard className="gold-steel-border flex flex-col justify-between gap-5 border border-[var(--border-default)] bg-white p-6 shadow-md">
            {/* Slide Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-[var(--border-subtle)] border-b pb-4">
              <div className="max-w-2xl space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Logo variant="gold" className="h-5 w-5 text-accent-gold" />
                  <span className="font-mono font-semibold text-[var(--accent-blue)] text-xs uppercase tracking-wider">
                    {activeSlide.chapter}
                  </span>
                  <Badge variant="amber-subtle" size="sm">
                    Slide {String(activeSlide.slideNumber).padStart(2, '0')} / {totalSlides}
                  </Badge>
                </div>
                <h3 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                  {activeSlide.title}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">{activeSlide.subtitle}</p>
              </div>

              <div className="rounded-xl border border-accent-gold/40 bg-[var(--bg-secondary)] px-4 py-3 text-right">
                <span className="block font-semibold text-[11px] text-[var(--text-muted)] uppercase">
                  {activeSlide.headlineMetric.label}
                </span>
                <span className="mt-0.5 block font-bold text-[var(--text-heading)] text-xl">
                  {activeSlide.headlineMetric.value}
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">
                  {activeSlide.headlineMetric.detail}
                </span>
              </div>
            </div>

            {/* Secondary Metrics Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {activeSlide.secondaryMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 px-4 py-3"
                >
                  <p className="font-medium text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                    {metric.label}
                  </p>
                  <p className="mt-1 font-bold text-[var(--text-heading)] text-lg">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-[var(--text-secondary)] text-xs">{metric.detail}</p>
                </div>
              ))}
            </div>

            {/* Dynamic Visual Stage */}
            <SlideVisualStage slide={activeSlide} snapshot={snapshot} />

            {/* Executive Takeaways */}
            <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]/50 p-4">
              <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Key Takeaways for Leadership &amp; Investors
              </p>
              <ul className="space-y-1.5">
                {activeSlide.highlights.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-[var(--text-heading)] text-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer Controls & Deep Link */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-subtle)] border-t pt-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={goToPrev} className={CONTROL_BTN_CLASS}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button type="button" onClick={goToNext} className={PRIMARY_ACTION_BTN_CLASS}>
                  <span>Next Slide</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {activeSlide.deepLink && (
                <Link
                  href={activeSlide.deepLink.href}
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-blue)] text-xs hover:underline"
                >
                  <span>{activeSlide.deepLink.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </GlassCard>

          {/* Speaker Notes Drawer */}
          {showSpeakerNotes && (
            <GlassCard className="border border-accent-gold/40 bg-white/95 p-4">
              <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                CEO &amp; Presenter Talking Points — Slide{' '}
                {String(activeSlide.slideNumber).padStart(2, '0')}
              </p>
              <p className="mt-1.5 text-[var(--text-heading)] text-sm leading-relaxed">
                {activeSlide.speakerNotes}
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
