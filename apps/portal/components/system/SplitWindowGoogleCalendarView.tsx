'use client';

import { cn } from '@repo/ui/lib/utils';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  ExternalLink,
  MapPin,
  Maximize2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useState } from 'react';
import {
  buildGoogleCalendarEventUrl,
  GOOGLE_CALENDAR_AUTO_SIGNIN_URL,
  getSiteCalendarEmbedUrl,
  openDockedGoogleWindow,
  SITE_CALENDAR_EMBED_SRC,
} from '~/lib/google-workspace';

interface ShiftPreset {
  readonly id: string;
  readonly name: string;
  readonly defaultTitle: string;
  readonly defaultDetails: string;
  readonly defaultLocation: string;
  readonly iconType: 'blast' | 'handover' | 'maintenance' | 'safety';
}

const SHIFT_PRESETS: readonly ShiftPreset[] = [
  {
    id: 'blast',
    name: 'Blast Exclusion Window',
    defaultTitle: 'Pit Blast Exclusion Window (Bench 3/4)',
    defaultDetails:
      'Clear pit radius 500m. Gate 2 and Gate 4 locked. Heavy plant relocated to Bench 1 safe zone.',
    defaultLocation: 'Pit Bench 3/4 East Zone',
    iconType: 'blast',
  },
  {
    id: 'day-handover',
    name: 'Day Shift Handover',
    defaultTitle: 'Drilling & Pit Operations Day Handover',
    defaultDetails:
      'Review meters drilled, blast patterns in progress, fuel bowser scheduling, operator logs.',
    defaultLocation: 'Control Room & Pit Office',
    iconType: 'handover',
  },
  {
    id: 'maintenance',
    name: 'Rig Preventive Maintenance',
    defaultTitle: 'Rig DR-01 Scheduled Maintenance (Bit & Lube)',
    defaultDetails:
      'Replace tricone bit #B-409, grease rotary head, pressure test hydraulic hoses.',
    defaultLocation: 'Central Rig Maintenance Bay',
    iconType: 'maintenance',
  },
  {
    id: 'safety',
    name: 'Safety & Geotech Briefing',
    defaultTitle: 'High-Wall Geotechnical Inspection & Pre-Shift Briefing',
    defaultDetails:
      'Radar survey verification, pit haul road condition audit, operator PPE compliance.',
    defaultLocation: 'Engineering Briefing Hall',
    iconType: 'safety',
  },
];

export function SplitWindowGoogleCalendarView() {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'event' | 'roster'>('calendar');
  const [iframeKey, setIframeKey] = useState(0);

  // Quick event form states
  const [eventTitle, setEventTitle] = useState(SHIFT_PRESETS[0]?.defaultTitle ?? '');
  const [eventDetails, setEventDetails] = useState(SHIFT_PRESETS[0]?.defaultDetails ?? '');
  const [eventLocation, setEventLocation] = useState(SHIFT_PRESETS[0]?.defaultLocation ?? '');
  const [selectedPresetId, setSelectedPresetId] = useState(SHIFT_PRESETS[0]?.id ?? '');

  const calendarEmbedUrl = getSiteCalendarEmbedUrl(SITE_CALENDAR_EMBED_SRC);

  const handleApplyPreset = (preset: ShiftPreset) => {
    setSelectedPresetId(preset.id);
    setEventTitle(preset.defaultTitle);
    setEventDetails(preset.defaultDetails);
    setEventLocation(preset.defaultLocation);
  };

  const handleLaunchGoogleCalendar = () => {
    if (typeof window !== 'undefined') {
      window.open(GOOGLE_CALENDAR_AUTO_SIGNIN_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleScheduleEvent = () => {
    const url = buildGoogleCalendarEventUrl({
      title: eventTitle,
      details: eventDetails,
      location: eventLocation,
    });
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/60">
      {/* Sub-Header & Controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-black/[0.06] border-b bg-white/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[12.5px] text-[var(--text-heading)]">
                Google Calendar &amp; Schedule
              </span>
              <span className="rounded-full bg-blue-500/10 px-1.5 py-0.2 font-semibold text-[9.5px] text-blue-700">
                SAST Live
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIframeKey((prev) => prev + 1)}
            title="Refresh Calendar Frame"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-black/[0.06] bg-white text-[var(--text-secondary)] shadow-2xs hover:bg-black/[0.03] hover:text-[var(--text-heading)]"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => openDockedGoogleWindow(GOOGLE_CALENDAR_AUTO_SIGNIN_URL)}
            title="Open side-by-side Popout Window"
            className="flex h-6 items-center gap-1 rounded-md border border-black/[0.06] bg-white px-2 font-medium text-[10.5px] text-[var(--text-secondary)] shadow-2xs hover:bg-black/[0.03] hover:text-[var(--text-heading)]"
          >
            <Maximize2 className="h-3 w-3" />
            <span className="hidden sm:inline">Popout Window</span>
          </button>
          <button
            type="button"
            onClick={handleLaunchGoogleCalendar}
            title="Open Google Calendar with active session"
            className="flex h-6 items-center gap-1 rounded-md bg-blue-600 px-2 font-semibold text-[10.5px] text-white shadow-2xs transition-opacity hover:opacity-90"
          >
            <span>Google Calendar</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex shrink-0 border-black/[0.06] border-b bg-black/[0.015] px-3 font-semibold text-[11px] text-[var(--text-muted)]">
        <button
          type="button"
          onClick={() => setActiveSubTab('calendar')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 py-2 pr-3 transition-colors',
            activeSubTab === 'calendar'
              ? 'border-blue-600 font-bold text-blue-600'
              : 'border-transparent hover:text-[var(--text-secondary)]'
          )}
        >
          <CalendarDays className="h-3 w-3" />
          <span>Live Site Calendar</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('event')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors',
            activeSubTab === 'event'
              ? 'border-blue-600 font-bold text-blue-600'
              : 'border-transparent hover:text-[var(--text-secondary)]'
          )}
        >
          <CalendarPlus className="h-3 w-3" />
          <span>Quick Shift Event</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('roster')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors',
            activeSubTab === 'roster'
              ? 'border-blue-600 font-bold text-blue-600'
              : 'border-transparent hover:text-[var(--text-secondary)]'
          )}
        >
          <Clock className="h-3 w-3" />
          <span>Shift Roster Windows</span>
        </button>
      </div>

      {/* Pane Content based on sub-tab */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeSubTab === 'calendar' && (
          <div className="flex min-h-0 flex-1 flex-col p-2">
            {calendarEmbedUrl ? (
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-2xs">
                <iframe
                  key={iframeKey}
                  src={calendarEmbedUrl}
                  title="Official Site Shift Calendar"
                  className="h-full w-full border-0"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <h4 className="mt-3 font-bold text-[14px] text-[var(--text-heading)]">
                  Live Shift Schedule
                </h4>
                <p className="mt-1 max-w-sm text-[12px] text-[var(--text-secondary)]">
                  Connect and view the active Google Calendar schedule directly or open your
                  authenticated account view.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleLaunchGoogleCalendar}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 font-semibold text-[12px] text-white shadow-2xs hover:bg-blue-700"
                  >
                    <span>Launch Google Calendar</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'event' && (
          <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5">
            <div>
              <p className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                Select Operational Event Type
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SHIFT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={cn(
                      'rounded-xl border p-2.5 text-left transition-all',
                      selectedPresetId === preset.id
                        ? 'border-blue-500/40 bg-blue-50/60 font-semibold text-blue-800'
                        : 'border-black/[0.06] bg-white text-[var(--text-secondary)] hover:bg-black/[0.02]'
                    )}
                  >
                    <span className="block text-[11.5px]">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-black/[0.06] bg-white p-3 shadow-2xs">
              <div>
                <label
                  htmlFor="cal-event-title"
                  className="block font-semibold text-[11px] text-[var(--text-muted)]"
                >
                  Event Title
                </label>
                <input
                  id="cal-event-title"
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/[0.08] px-2.5 py-1.5 text-[12px] text-[var(--text-heading)] focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="cal-event-location"
                  className="block font-semibold text-[11px] text-[var(--text-muted)]"
                >
                  Location / Pit Zone
                </label>
                <div className="relative mt-1">
                  <MapPin className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    id="cal-event-location"
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    className="w-full rounded-lg border border-black/[0.08] py-1.5 pr-2.5 pl-8 text-[12px] text-[var(--text-heading)] focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cal-event-details"
                  className="block font-semibold text-[11px] text-[var(--text-muted)]"
                >
                  Operational Notes &amp; Safety Interlocks
                </label>
                <textarea
                  id="cal-event-details"
                  value={eventDetails}
                  onChange={(e) => setEventDetails(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-black/[0.08] p-2 text-[11.5px] text-[var(--text-heading)] leading-relaxed focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleScheduleEvent}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 font-semibold text-[12px] text-white shadow-2xs hover:bg-blue-700"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>Schedule in Google Calendar (Auto Sign-In)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'roster' && (
          <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-[12px]">
            <div className="rounded-xl border border-black/[0.06] bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-[12.5px] text-[var(--text-heading)]">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>Daily Shift Windows (Africa/Johannesburg SAST)</span>
              </div>
              <ul className="mt-2.5 space-y-2 text-[11.5px] text-[var(--text-secondary)]">
                <li className="flex justify-between border-black/[0.04] border-b pb-1.5">
                  <span className="font-semibold text-[var(--text-heading)]">Day Shift:</span>
                  <span>06:00 – 18:00 (12 hrs)</span>
                </li>
                <li className="flex justify-between border-black/[0.04] border-b pb-1.5">
                  <span className="font-semibold text-[var(--text-heading)]">Night Shift:</span>
                  <span>18:00 – 06:00 (12 hrs)</span>
                </li>
                <li className="flex justify-between border-black/[0.04] border-b pb-1.5">
                  <span className="font-semibold text-dept-drilling">Blast Exclusion Window:</span>
                  <span className="font-mono text-dept-drilling">12:00 – 13:00 (Daily)</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold text-[var(--text-heading)]">
                    Rig Maintenance PM:
                  </span>
                  <span>13:00 – 14:30 (Staggered)</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 font-bold text-[12px] text-amber-800">
                <ShieldAlert className="h-4 w-4" />
                <span>Safety Critical Interlock</span>
              </div>
              <p className="mt-1 text-[11px] text-amber-900/80 leading-relaxed">
                All blast exclusion times must be entered into Google Calendar at least 3 hours
                prior to detonation to trigger automatic SMS/WhatsApp perimeter notifications to
                haulage crews.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
