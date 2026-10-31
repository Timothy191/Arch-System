'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FilePlus2,
  FileText,
  PlusCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import * as React from 'react';
import {
  GOOGLE_CALENDAR_AUTO_SIGNIN_URL,
  GOOGLE_CALENDAR_CREATE_EVENT_URL,
  GOOGLE_CALENDAR_URL,
  GOOGLE_DOCS_AUTO_SIGNIN_URL,
  GOOGLE_DOCS_CREATE_URL,
  GOOGLE_DOCS_URL,
  GOOGLE_DRIVE_URL,
} from '~/lib/google-workspace';

export type GoogleWorkspaceService = 'docs' | 'calendar';

export interface WorkspaceAction {
  readonly label: string;
  readonly hint: string;
  readonly href: string;
}

interface ServiceConfig {
  readonly title: string;
  readonly description: string;
  readonly sessionHint: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly iconTileClass: string;
  readonly iconClass: string;
  readonly handoffTitle: string;
  readonly handoffSteps: readonly string[];
  readonly directRedirectUrl: string;
}

const SERVICE_CONFIG: Record<GoogleWorkspaceService, ServiceConfig> = {
  docs: {
    title: 'Google Docs Workspace',
    description:
      'Create, review, and collaborate on drilling logs, shift reports, and geotechnical documents in Google Docs, seamlessly integrated within the Arch OS portal.',
    sessionHint:
      'Auto-connects via your active Google browser session — no secondary password prompt required.',
    icon: FileText,
    iconTileClass: 'bg-dept-drilling/10',
    iconClass: 'text-dept-drilling',
    handoffTitle: 'How Google Docs Integration Works',
    handoffSteps: [
      'Click below to launch Google Docs directly or create a new mining document in a new tab.',
      'Google automatically reuses your authenticated Google Workspace session.',
      'Your real-time changes and comments sync to Google Drive while Arch OS maintains your operational context.',
    ],
    directRedirectUrl: GOOGLE_DOCS_AUTO_SIGNIN_URL,
  },
  calendar: {
    title: 'Google Calendar & Shift Schedule',
    description:
      'Plan drilling campaigns, blast exclusion windows, shift handovers, and equipment maintenance against the official site Google Calendar.',
    sessionHint:
      'Auto-connects via your active Google browser session with Africa/Johannesburg (SAST) timezone alignment.',
    icon: CalendarDays,
    iconTileClass: 'bg-dept-control-room/10',
    iconClass: 'text-dept-control-room',
    handoffTitle: 'How Google Calendar Integration Works',
    handoffSteps: [
      'Open Google Calendar directly or view the shared published site calendar embedded below.',
      'Google automatically synchronizes with your active account to display shift schedules.',
      'Operational blast times and rig maintenance rosters remain unified across mobile and web.',
    ],
    directRedirectUrl: GOOGLE_CALENDAR_AUTO_SIGNIN_URL,
  },
};

export const DOCUMENTS_ACTIONS: readonly WorkspaceAction[] = [
  {
    label: 'Launch Google Docs (Auto Sign-In)',
    hint: 'Opens Google Docs with your active Google account',
    href: GOOGLE_DOCS_AUTO_SIGNIN_URL,
  },
  {
    label: 'Create New Blank Document',
    hint: 'Instantly start a new operational document',
    href: GOOGLE_DOCS_CREATE_URL,
  },
  {
    label: 'Open Mining Google Drive',
    hint: 'Browse shared departmental folders and archives',
    href: GOOGLE_DRIVE_URL,
  },
  {
    label: 'Standard Google Docs Home',
    hint: 'Document templates and recent files',
    href: GOOGLE_DOCS_URL,
  },
];

export const SCHEDULE_ACTIONS: readonly WorkspaceAction[] = [
  {
    label: 'Launch Google Calendar (Auto Sign-In)',
    hint: 'Opens Google Calendar with your active Google account',
    href: GOOGLE_CALENDAR_AUTO_SIGNIN_URL,
  },
  {
    label: 'Create New Shift / Blast Event',
    hint: 'Schedule blast exclusion or maintenance shutdown',
    href: GOOGLE_CALENDAR_CREATE_EVENT_URL,
  },
  {
    label: 'Open Standard Calendar View',
    hint: 'Your day, week, and month operational schedule',
    href: GOOGLE_CALENDAR_URL,
  },
  {
    label: 'Open Shift Documentation in Docs',
    hint: 'Meeting notes, safety briefings, and handover logs',
    href: GOOGLE_DOCS_AUTO_SIGNIN_URL,
  },
];

const MINING_DOC_TEMPLATES = [
  {
    title: 'Drill Rig Pre-Start Checklist',
    description:
      'Daily inspection of hydraulic pressure, bit wear, engine fluids, and safety interlocks.',
    href: GOOGLE_DOCS_CREATE_URL,
  },
  {
    title: 'Shift Handover & Operations Memo',
    description:
      'Log drilled meters, hole counts, operator sign-offs, and pit delay categorization.',
    href: GOOGLE_DOCS_CREATE_URL,
  },
  {
    title: 'Blast Window & Pattern Design',
    description:
      'Drill pattern specifications, bench burden, spacing, and geotechnical hazard protocols.',
    href: GOOGLE_DOCS_CREATE_URL,
  },
  {
    title: 'Equipment Incident / Breakdown Report',
    description:
      'Engineering root-cause analysis, downtime hours, spare parts, and mechanical sign-off.',
    href: GOOGLE_DOCS_CREATE_URL,
  },
];

const SCHEDULE_MILESTONES = [
  {
    title: 'Day Shift Production Window',
    time: '06:00 - 18:00 SAST',
    tag: 'Production',
    color: 'text-dept-production bg-dept-production/10 border-dept-production/20',
  },
  {
    title: 'Pit Blast Exclusion Window',
    time: '14:00 - 14:45 SAST',
    tag: 'Safety Critical',
    color: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20',
  },
  {
    title: 'Night Shift Handover & Briefing',
    time: '17:45 - 18:15 SAST',
    tag: 'Handover',
    color: 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/20',
  },
  {
    title: 'Drill Rig Routine Maintenance Window',
    time: '04:00 - 06:00 SAST',
    tag: 'Engineering',
    color: 'text-dept-engineering bg-dept-engineering/10 border-dept-engineering/20',
  },
];

interface GoogleWorkspacePanelProps {
  readonly service: GoogleWorkspaceService;
  readonly actions: readonly WorkspaceAction[];
  /** Frameable Google Calendar embed URL; `null` when no site calendar is published. */
  readonly embedUrl?: string | null;
}

const AUTO_SIGNIN_BADGE_CLASSES =
  'gold-steel-border gold-steel-border-slim inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/80 px-2.5 py-1.5 font-semibold text-[10px] text-[var(--text-heading)] uppercase tracking-wider';

export function GoogleWorkspacePanel({
  service,
  actions,
  embedUrl = null,
}: GoogleWorkspacePanelProps) {
  const config = SERVICE_CONFIG[service];
  const ServiceIcon = config.icon;

  const handleDirectRedirect = () => {
    if (typeof window !== 'undefined') {
      window.open(config.directRedirectUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Workspace Card */}
      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/[0.06] shadow-2xs',
                config.iconTileClass
              )}
            >
              <ServiceIcon className={cn('h-6 w-6', config.iconClass)} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[var(--text-heading)] text-xl">{config.title}</h2>
                <span className="rounded-full bg-accent-green/10 px-2 py-0.5 font-medium text-[11px] text-accent-green">
                  Ready
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-[var(--text-secondary)] text-sm">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDirectRedirect}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent-blue)] px-4 py-2 font-semibold text-white text-xs shadow-xs transition-opacity hover:opacity-90 active:scale-95"
            >
              <span>Launch {service === 'docs' ? 'Google Docs' : 'Google Calendar'}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <span className={AUTO_SIGNIN_BADGE_CLASSES}>
              <ShieldCheck className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" />
              Auto Sign-In Enabled
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-black/[0.06] bg-black/[0.015] px-3.5 py-2 text-[12px] text-[var(--text-muted)]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-green" />
          <span>{config.sessionHint}</span>
        </div>

        {/* Quick Launch Actions */}
        <div className="mt-5">
          <p className="mb-2.5 font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
            Quick Actions &amp; Deep Links
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-black/[0.06] bg-white/80 p-3.5 shadow-2xs transition-all hover:border-[var(--accent-blue)]/30 hover:bg-white hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-[13px] text-[var(--text-heading)] group-hover:text-[var(--accent-blue)]">
                      {action.label}
                    </span>
                    <ExternalLink
                      className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-blue)]"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--text-muted)] leading-relaxed">
                    {action.hint}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Operational Context Sections */}
      {service === 'docs' ? (
        <GlassCard className="overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--text-heading)] text-base">
                Operational Drilling &amp; Mining Templates
              </h3>
              <p className="text-[var(--text-secondary)] text-xs">
                Launch standardized shift documentation directly into Google Docs
              </p>
            </div>
            <a
              href={GOOGLE_DOCS_CREATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-medium text-[11.5px] text-[var(--text-heading)] shadow-2xs transition-colors hover:bg-black/[0.03]"
            >
              <FilePlus2 className="h-3.5 w-3.5 text-dept-drilling" />
              <span>Blank Document</span>
            </a>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MINING_DOC_TEMPLATES.map((tmpl) => (
              <a
                key={tmpl.title}
                href={tmpl.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-black/[0.06] bg-white/70 p-3.5 transition-all hover:border-dept-drilling/40 hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px] text-[var(--text-heading)] group-hover:text-dept-drilling">
                      {tmpl.title}
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-dept-drilling opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--text-muted)] leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>
                <span className="mt-2.5 inline-flex items-center gap-1 font-medium text-[11px] text-dept-drilling">
                  Open template in Docs &rarr;
                </span>
              </a>
            ))}
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--text-heading)] text-base">
                Today&apos;s Site Operational Milestones
              </h3>
              <p className="text-[var(--text-secondary)] text-xs">
                Synchronized shift intervals and mandatory blast safety windows
              </p>
            </div>
            <a
              href={GOOGLE_CALENDAR_CREATE_EVENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-medium text-[11.5px] text-[var(--text-heading)] shadow-2xs transition-colors hover:bg-black/[0.03]"
            >
              <PlusCircle className="h-3.5 w-3.5 text-dept-control-room" />
              <span>Schedule Event</span>
            </a>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SCHEDULE_MILESTONES.map((mile) => (
              <div
                key={mile.title}
                className="flex flex-col justify-between rounded-xl border border-black/[0.06] bg-white/70 p-3.5"
              >
                <div>
                  <span
                    className={cn(
                      'inline-block rounded-md border px-2 py-0.5 font-semibold text-[10px]',
                      mile.color
                    )}
                  >
                    {mile.tag}
                  </span>
                  <h4 className="mt-2 font-semibold text-[12.5px] text-[var(--text-heading)] leading-snug">
                    {mile.title}
                  </h4>
                </div>
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" />
                  <span>{mile.time}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Frameable Calendar if available */}
      {embedUrl ? (
        <GlassCard className="overflow-hidden">
          <div className="mb-3">
            <h3 className="font-medium text-[var(--text-heading)]">Published Site Calendar</h3>
            <p className="text-[var(--text-secondary)] text-sm">
              Read-only view of the shared shift calendar, rendered inside the portal.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--border-emphasis)] bg-white">
            <iframe
              src={embedUrl}
              title="Published site calendar"
              className="h-[640px] w-full"
              loading="lazy"
            />
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <h3 className="font-semibold text-[var(--text-heading)] text-sm">
            {config.handoffTitle}
          </h3>
          <ol className="mt-2.5 space-y-2 text-[var(--text-secondary)] text-xs">
            {config.handoffSteps.map((step) => (
              <li key={step} className="flex gap-2.5">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-blue)]"
                  aria-hidden="true"
                />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </GlassCard>
      )}

      <p className="text-[11px] text-[var(--text-muted)]">
        Google enforces <span className="font-mono">X-Frame-Options: SAMEORIGIN</span> on signed-in
        Google Workspace surfaces, so authenticated Docs and Calendars launch with
        auto-authentication in a new tab. Arch OS preserves your department session and tab state.
      </p>
    </div>
  );
}
