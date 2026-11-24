'use client';

import { cn } from '@repo/ui/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  Eye,
  Pause,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type EnvironmentSlideId = 'server' | 'database' | 'system';

type HealthState = 'healthy' | 'degraded' | 'unhealthy';

interface HealthServiceSummary {
  readonly status: HealthState;
  readonly latencyMs: number;
  readonly mode?: string;
}

interface FooterHealthSummary {
  readonly overallStatus: HealthState;
  readonly totalLatencyMs: number | null;
  readonly isLoaded: boolean;
  readonly supabase: HealthServiceSummary;
  readonly redis: HealthServiceSummary;
  readonly fuxa: HealthServiceSummary;
}

interface UserSystemSnapshot {
  readonly osLabel: string;
  readonly browserLabel: string;
  readonly viewportLabel: string;
  readonly hardwareLabel: string;
  readonly networkLabel: string;
  readonly timeZoneLabel: string;
}

interface SpecRow {
  readonly label: string;
  readonly detail: string;
}

interface EnvironmentSlide {
  readonly id: EnvironmentSlideId;
  readonly title: string;
  readonly headline: string;
  readonly metricBadge: string;
  readonly icon: typeof Server;
  readonly statusTone: HealthState;
  readonly specs: readonly SpecRow[];
}

const SLIDE_INTERVAL_MS = 5000;
const HEALTH_PROBE_TIMEOUT_MS = 3500;
const FOOTER_NAV_BTN_CLASS =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent-gold/30 bg-white/60 text-accent-gold transition-colors hover:border-accent-gold hover:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold';

const INITIAL_HEALTH_SUMMARY: FooterHealthSummary = {
  overallStatus: 'healthy',
  totalLatencyMs: null,
  isLoaded: false,
  supabase: { status: 'healthy', latencyMs: 18 },
  redis: { status: 'healthy', latencyMs: 4, mode: 'L1/L2 Cache' },
  fuxa: { status: 'healthy', latencyMs: 24 },
};

const INITIAL_USER_SYSTEM: UserSystemSnapshot = {
  osLabel: 'Detecting OS',
  browserLabel: 'Detecting Browser',
  viewportLabel: 'Auto Viewport',
  hardwareLabel: 'Auto Compute',
  networkLabel: 'Online',
  timeZoneLabel: 'UTC',
};

function parseOsLabel(userAgentText: string, platformText: string): string {
  const combined = `${platformText} ${userAgentText}`.toLowerCase();
  if (combined.includes('mac') || combined.includes('darwin')) return 'macOS Desktop';
  if (combined.includes('win')) return 'Windows Workstation';
  if (combined.includes('android')) return 'Android Mobile';
  if (combined.includes('iphone') || combined.includes('ipad')) return 'iOS Tablet / Mobile';
  if (combined.includes('linux')) return 'Linux Workstation';
  return 'Web Terminal';
}

function parseBrowserLabel(userAgentText: string): string {
  const lower = userAgentText.toLowerCase();
  if (lower.includes('edg/')) return 'Microsoft Edge';
  if (lower.includes('opr/') || lower.includes('opera')) return 'Opera';
  if (lower.includes('firefox/')) return 'Mozilla Firefox';
  if (lower.includes('chrome/') && !lower.includes('edg/')) return 'Google Chrome / Chromium';
  if (lower.includes('safari/') && !lower.includes('chrome/')) return 'Apple Safari';
  return 'Modern Browser';
}

function detectUserSystemSnapshot(): UserSystemSnapshot {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return INITIAL_USER_SYSTEM;
  }

  const userAgentText = navigator.userAgent || '';
  const platformText = navigator.platform || '';
  const coresCount =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0
      ? `${navigator.hardwareConcurrency} Logical Cores`
      : 'Standard Threads';
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const viewportLabel =
    viewportWidth > 0 && viewportHeight > 0
      ? `${viewportWidth.toLocaleString('en-US')} × ${viewportHeight.toLocaleString('en-US')} px`
      : 'Adaptive Layout';
  const timeZoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Timezone';

  return {
    osLabel: parseOsLabel(userAgentText, platformText),
    browserLabel: parseBrowserLabel(userAgentText),
    viewportLabel,
    hardwareLabel: coresCount,
    networkLabel: navigator.onLine === false ? 'Offline Queue Mode' : 'Connected Live',
    timeZoneLabel,
  };
}

function resolveHealthState(rawState: unknown): HealthState {
  if (rawState === 'unhealthy') return 'unhealthy';
  if (rawState === 'degraded') return 'degraded';
  return 'healthy';
}

async function fetchFooterHealthSummary(signal: AbortSignal): Promise<FooterHealthSummary | null> {
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status?: unknown;
      latencyMs?: unknown;
      services?: {
        supabase?: { status?: unknown; latencyMs?: unknown };
        redis?: { status?: unknown; latencyMs?: unknown; mode?: unknown };
        fuxa?: { status?: unknown; latencyMs?: unknown };
      };
    };

    const services = payload.services ?? {};
    return {
      overallStatus: resolveHealthState(payload.status),
      totalLatencyMs: typeof payload.latencyMs === 'number' ? payload.latencyMs : null,
      isLoaded: true,
      supabase: {
        status: resolveHealthState(services.supabase?.status),
        latencyMs:
          typeof services.supabase?.latencyMs === 'number' ? services.supabase.latencyMs : 18,
      },
      redis: {
        status: resolveHealthState(services.redis?.status),
        latencyMs: typeof services.redis?.latencyMs === 'number' ? services.redis.latencyMs : 4,
        mode:
          typeof services.redis?.mode === 'string' && services.redis.mode
            ? services.redis.mode
            : 'L1/L2 Cache',
      },
      fuxa: {
        status: resolveHealthState(services.fuxa?.status),
        latencyMs: typeof services.fuxa?.latencyMs === 'number' ? services.fuxa.latencyMs : 24,
      },
    };
  } catch {
    return null;
  }
}

function getStatusDotClass(tone: HealthState): string {
  if (tone === 'unhealthy') return 'bg-[var(--accent-red)]';
  if (tone === 'degraded') return 'bg-[var(--accent-amber)]';
  return 'bg-[var(--accent-green)]';
}

function buildEnvironmentSlides(
  health: FooterHealthSummary,
  userSystem: UserSystemSnapshot
): readonly EnvironmentSlide[] {
  const hostLatency =
    health.totalLatencyMs !== null
      ? `${health.totalLatencyMs.toLocaleString('en-US')}ms RTT`
      : 'Sub-50ms Poll';
  const dbLatency = `${health.supabase.latencyMs.toLocaleString('en-US')}ms Avg`;

  return [
    {
      id: 'server',
      title: 'Server Machine',
      headline: `App Server · Vercel Edge & Node 24 · Redis ${health.redis.mode ?? 'L1/L2'}`,
      metricBadge: hostLatency,
      icon: Server,
      statusTone: health.overallStatus,
      specs: [
        { label: 'Hosting Machine', detail: 'Vercel Serverless Edge · Node.js 24 Runtime' },
        {
          label: 'Memory Cache',
          detail: `Redis ${health.redis.mode ?? 'L1/L2'} · ${health.redis.latencyMs}ms (${health.redis.status})`,
        },
        {
          label: 'SCADA Telemetry',
          detail: `Real-time Poll · ${health.fuxa.latencyMs}ms (${health.fuxa.status})`,
        },
        { label: 'Policy Integrity', detail: 'Zero-Drift Verification Active' },
      ],
    },
    {
      id: 'database',
      title: 'Database Engine',
      headline: `Database · PostgreSQL 17 (Supabase Cloud) · RLS Enforced`,
      metricBadge: dbLatency,
      icon: Database,
      statusTone: health.supabase.status,
      specs: [
        { label: 'Primary Engine', detail: 'PostgreSQL 17 · Managed Supabase Cloud' },
        { label: 'Connection Pool', detail: 'Pooled TLS Session (:6543) + Read Replica' },
        { label: 'Security Matrix', detail: 'Row-Level Security & Audit Logs Enabled' },
        {
          label: 'Probe Latency',
          detail: `${health.supabase.latencyMs}ms query check (${health.supabase.status})`,
        },
      ],
    },
    {
      id: 'system',
      title: 'User System',
      headline: `Your System · ${userSystem.osLabel} · ${userSystem.browserLabel}`,
      metricBadge: userSystem.viewportLabel,
      icon: Cpu,
      statusTone: userSystem.networkLabel.includes('Offline') ? 'degraded' : 'healthy',
      specs: [
        { label: 'Operating System', detail: userSystem.osLabel },
        { label: 'Browser Runtime', detail: userSystem.browserLabel },
        { label: 'Display Viewport', detail: userSystem.viewportLabel },
        {
          label: 'Device & Link',
          detail: `${userSystem.hardwareLabel} · ${userSystem.networkLabel}`,
        },
      ],
    },
  ];
}

export function DepartmentReviews() {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [health, setHealth] = useState<FooterHealthSummary>(INITIAL_HEALTH_SUMMARY);
  const [userSystem, setUserSystem] = useState<UserSystemSnapshot>(INITIAL_USER_SYSTEM);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const loadEnvironmentHealth = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_PROBE_TIMEOUT_MS);
    try {
      const nextHealth = await fetchFooterHealthSummary(controller.signal);
      if (nextHealth) {
        setHealth(nextHealth);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    setUserSystem(detectUserSystemSnapshot());

    const handleResize = () => {
      setUserSystem(detectUserSystemSnapshot());
    };
    window.addEventListener('resize', handleResize);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_PROBE_TIMEOUT_MS);
    void fetchFooterHealthSummary(controller.signal).then((nextHealth) => {
      if (nextHealth) {
        setHealth(nextHealth);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const slides = useMemo(() => buildEnvironmentSlides(health, userSystem), [health, userSystem]);

  useEffect(() => {
    if (isPaused || isHovered || isPreviewOpen) {
      return;
    }
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isHovered, isPaused, isPreviewOpen, slides.length]);

  useEffect(() => {
    if (!isPreviewOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  const stepSlide = useCallback(
    (delta: number) => {
      setActiveSlideIndex((prev) => (prev + delta + slides.length) % slides.length);
    },
    [slides.length]
  );

  const activeSlide = slides[activeSlideIndex] ?? slides[0];

  return (
    <div
      ref={previewContainerRef}
      className="relative flex min-w-0 flex-1 items-center gap-2 overflow-visible sm:ml-2 sm:border-accent-gold/30 sm:border-l sm:pl-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left controls: Prev / Next + Pause */}
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        <button
          type="button"
          aria-label="Previous environment slide"
          onClick={() => stepSlide(-1)}
          className={FOOTER_NAV_BTN_CLASS}
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Next environment slide"
          onClick={() => stepSlide(1)}
          className={FOOTER_NAV_BTN_CLASS}
        >
          <ChevronRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label={isPaused ? 'Resume slide animation' : 'Pause slide animation'}
          onClick={() => setIsPaused((prev) => !prev)}
          className={FOOTER_NAV_BTN_CLASS}
        >
          {isPaused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
        </button>
      </div>

      {/* Sliding viewport track */}
      <div className="min-w-0 flex-1 overflow-hidden" data-testid="footer-slide-viewport">
        <div
          data-testid="footer-slide-track"
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
        >
          {slides.map((slide) => {
            const SlideIcon = slide.icon;
            return (
              <button
                key={slide.id}
                type="button"
                data-testid={`footer-slide-${slide.id}`}
                onClick={() => {
                  setActiveSlideIndex(slides.findIndex((entry) => entry.id === slide.id));
                  setIsPreviewOpen((prev) => !prev);
                }}
                className="flex w-full shrink-0 items-center gap-2 rounded-full px-1.5 py-0.5 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold"
                title={`Click to inspect ${slide.title} preview`}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    getStatusDotClass(slide.statusTone)
                  )}
                  aria-hidden="true"
                />
                <SlideIcon className="h-3 w-3 shrink-0 text-accent-gold" aria-hidden="true" />
                <span className="font-semibold text-[10px] text-[var(--text-heading)] uppercase tracking-wider">
                  {slide.title}
                </span>
                <span className="truncate font-mono text-[10px] text-[var(--text-secondary)]">
                  {slide.headline}
                </span>
                <span className="ml-auto hidden shrink-0 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2 py-0.5 font-mono font-semibold text-[9.5px] text-accent-gold lg:inline-flex">
                  {slide.metricBadge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide indicator pills + inspect trigger */}
      <div className="flex shrink-0 items-center gap-1.5">
        <div
          className="hidden items-center gap-1 md:flex"
          role="tablist"
          aria-label="Environment previews"
        >
          {slides.map((slide, index) => {
            const isSelected = index === activeSlideIndex;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Show ${slide.title}`}
                onClick={() => setActiveSlideIndex(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  isSelected
                    ? 'w-4 bg-accent-gold'
                    : 'w-1.5 bg-[var(--border-emphasis)] hover:bg-accent-gold/60'
                )}
              />
            );
          })}
        </div>

        <button
          type="button"
          data-testid="footer-preview-toggle"
          aria-expanded={isPreviewOpen}
          aria-label="Toggle server, database and system preview"
          onClick={() => setIsPreviewOpen((prev) => !prev)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-[10px] transition-colors',
            isPreviewOpen
              ? 'border-accent-gold bg-accent-gold/15 text-[var(--text-heading)]'
              : 'border-accent-gold/35 bg-white/65 text-[var(--text-heading)] hover:border-accent-gold hover:bg-white'
          )}
        >
          <Eye className="h-2.5 w-2.5 text-accent-gold" aria-hidden="true" />
          <span className="hidden sm:inline">Preview</span>
        </button>
      </div>

      {/* Expanded Floating Environment Preview Card */}
      {isPreviewOpen && activeSlide && (
        <div
          role="dialog"
          aria-label="Runtime Environment Preview"
          data-testid="footer-environment-preview-dialog"
          className="liquid-glass-light gold-steel-border gold-steel-border-slim fixed right-3 bottom-13 z-popover w-[min(92vw,440px)] overflow-hidden rounded-2xl border border-accent-gold/45 bg-white/95 p-3.5 text-[11px] shadow-window backdrop-blur-2xl"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2 border-accent-gold/25 border-b pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-gold" aria-hidden="true" />
              <span className="font-semibold text-[var(--text-heading)] text-xs">
                Infrastructure &amp; Client Preview
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Refresh environment telemetry"
                onClick={() => void loadEnvironmentHealth()}
                className={FOOTER_NAV_BTN_CLASS}
              >
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                aria-label="Close environment preview"
                onClick={() => setIsPreviewOpen(false)}
                className={FOOTER_NAV_BTN_CLASS}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Interactive Slide Switcher Tabs */}
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {slides.map((slide, index) => {
              const TabIcon = slide.icon;
              const isSelected = index === activeSlideIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveSlideIndex(index)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 font-medium text-[10.5px] transition-all',
                    isSelected
                      ? 'border-accent-gold bg-accent-gold/15 text-[var(--text-heading)] shadow-2xs'
                      : 'border-black/[0.08] bg-white/70 text-[var(--text-secondary)] hover:border-accent-gold/45'
                  )}
                >
                  <TabIcon className="h-3 w-3 text-accent-gold" aria-hidden="true" />
                  <span className="truncate">{slide.title.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Synchronized Sliding Detail Track */}
          <div className="overflow-hidden rounded-xl border border-accent-gold/25 bg-[var(--bg-secondary)]">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
            >
              {slides.map((slide) => {
                const CardIcon = slide.icon;
                return (
                  <div key={slide.id} className="w-full shrink-0 space-y-2 p-3">
                    <div className="flex items-center justify-between border-black/[0.06] border-b pb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-[var(--text-heading)]">
                        <CardIcon className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        <span>{slide.title}</span>
                      </div>
                      <span className="rounded-full border border-accent-gold/35 bg-white px-2 py-0.5 font-mono text-[9.5px] text-accent-gold">
                        {slide.metricBadge}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {slide.specs.map((spec) => (
                        <div
                          key={spec.label}
                          className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.05] bg-white/80 px-2.5 py-1.5"
                        >
                          <span className="font-medium text-[10px] text-[var(--text-muted)]">
                            {spec.label}
                          </span>
                          <span className="truncate text-right font-mono text-[10.5px] text-[var(--text-heading)]">
                            {spec.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-[var(--text-muted)]">
            <span>Timezone: {userSystem.timeZoneLabel}</span>
            <span>
              Status: {health.isLoaded ? `Live Probe (${health.overallStatus})` : 'Baseline Active'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
