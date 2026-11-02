/**
 * Google Workspace entry points used by the Documents and Schedule workspaces.
 *
 * Why deep links and not an embedded Google surface: Google serves
 * `docs.google.com`, `drive.google.com` and `calendar.google.com` with
 * `X-Frame-Options: SAMEORIGIN`, so a signed-in Google app can never render
 * inside the portal. Opening these URLs in a new tab reuses whatever Google
 * session the browser already holds — that is the only automatic sign-in
 * available without storing per-user Google OAuth tokens.
 *
 * The one frameable Google surface is the calendar embed endpoint, and only for
 * calendars that are shared publicly. It is wired through
 * `NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_SRC` so a site can publish its shift
 * calendar without any per-user credentials.
 */

export const GOOGLE_DOCS_URL = 'https://docs.google.com/document/u/0/';
export const GOOGLE_DOCS_AUTO_SIGNIN_URL =
  'https://accounts.google.com/AccountChooser?continue=https://docs.google.com/document/u/0/';
export const GOOGLE_DOCS_CREATE_URL = 'https://docs.google.com/document/create';
export const GOOGLE_DRIVE_URL = 'https://drive.google.com/drive/my-drive';
export const GOOGLE_CALENDAR_URL = 'https://calendar.google.com/calendar/u/0/r';
export const GOOGLE_CALENDAR_AUTO_SIGNIN_URL =
  'https://accounts.google.com/AccountChooser?continue=https://calendar.google.com/calendar/u/0/r';
export const GOOGLE_CALENDAR_CREATE_EVENT_URL = 'https://calendar.google.com/calendar/r/eventedit';

/** Operational timezone for the mine — matches shift windows in SAST. */
export const OPERATIONAL_TIMEZONE = 'Africa/Johannesburg';

const CALENDAR_EMBED_ENDPOINT = 'https://calendar.google.com/calendar/embed';
const CALENDAR_EMBED_MODE = 'MONTH';

/** Default fallback public calendar ID for demo / testing when none configured */
export const DEFAULT_SITE_CALENDAR_SRC = 'en.sa#holiday@group.v.calendar.google.com';

/**
 * Public calendar id (or comma-separated ids) the site wants framed. Public
 * calendar ids are not secrets, so a `NEXT_PUBLIC_` variable is appropriate.
 */
export const SITE_CALENDAR_EMBED_SRC = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_SRC;

/**
 * Build the frameable Google Calendar embed URL, or `null` when no calendar has
 * been configured for the deployment.
 */
export function getSiteCalendarEmbedUrl(calendarSrc?: string | null): string | null {
  const trimmed = calendarSrc?.trim() || DEFAULT_SITE_CALENDAR_SRC;
  if (!trimmed) return null;

  const params = new URLSearchParams({
    src: trimmed,
    mode: CALENDAR_EMBED_MODE,
    ctz: OPERATIONAL_TIMEZONE,
    showTitle: '0',
    showPrint: '0',
    showTabs: '0',
    showCalendars: '0',
  });

  return `${CALENDAR_EMBED_ENDPOINT}?${params.toString()}`;
}

/**
 * Build Google Calendar event creation URL with prefilled parameters.
 */
export function buildGoogleCalendarEventUrl(options: {
  readonly title: string;
  readonly details?: string;
  readonly location?: string;
}): string {
  const params = new URLSearchParams();
  if (options.title) params.set('text', options.title);
  if (options.details) params.set('details', options.details);
  if (options.location) params.set('location', options.location);
  params.set('ctz', OPERATIONAL_TIMEZONE);
  return `${GOOGLE_CALENDAR_CREATE_EVENT_URL}?${params.toString()}`;
}
