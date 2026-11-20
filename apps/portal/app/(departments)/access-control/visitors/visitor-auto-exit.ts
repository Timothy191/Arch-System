export const VISITOR_AUTO_EXIT_HOURS = 12;
export const VISITOR_AUTO_EXIT_MS = VISITOR_AUTO_EXIT_HOURS * 60 * 60 * 1000;
export const AUTO_EXITED_VISITOR_STATUS = 'Auto-Exited (12h)';
export const MANUAL_CHECKED_OUT_STATUS = 'Checked Out';
const MS_PER_MINUTE = 60 * 1000;

export interface AutoExitCandidateVisitor {
  readonly status?: string | null;
  readonly check_out_time?: string | null;
  readonly check_in_time?: string | null;
  readonly created_at?: string | null;
}

export interface VisitorDurationStatus {
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly isOverdue: boolean;
  readonly elapsedLabel: string;
  readonly remainingLabel: string;
  readonly summaryLabel: string;
}

function formatHoursMinutes(durationMs: number): string {
  const safeMs = Math.max(0, durationMs);
  const totalMinutes = Math.floor(safeMs / MS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function isTimestampOverdueForAutoExit(
  timestamp: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!timestamp) return false;
  const parsedMs = new Date(timestamp).getTime();
  if (!Number.isFinite(parsedMs)) return false;
  return nowMs - parsedMs >= VISITOR_AUTO_EXIT_MS;
}

export function isVisitorOverdueForAutoExit(
  visitor: AutoExitCandidateVisitor,
  nowMs: number = Date.now()
): boolean {
  if (visitor.status !== 'Checked In') return false;
  if (visitor.check_out_time) return false;
  const referenceTimestamp = visitor.check_in_time ?? visitor.created_at;
  return isTimestampOverdueForAutoExit(referenceTimestamp, nowMs);
}

export function formatRemainingOrElapsed(
  checkInTime: string | null | undefined,
  nowMs: number = Date.now()
): VisitorDurationStatus {
  if (!checkInTime) {
    return {
      elapsedMs: 0,
      remainingMs: VISITOR_AUTO_EXIT_MS,
      isOverdue: false,
      elapsedLabel: '0h 00m',
      remainingLabel: `${VISITOR_AUTO_EXIT_HOURS}h 00m left`,
      summaryLabel: 'No check-in timestamp',
    };
  }

  const checkInMs = new Date(checkInTime).getTime();
  if (!Number.isFinite(checkInMs)) {
    return {
      elapsedMs: 0,
      remainingMs: VISITOR_AUTO_EXIT_MS,
      isOverdue: false,
      elapsedLabel: '0h 00m',
      remainingLabel: `${VISITOR_AUTO_EXIT_HOURS}h 00m left`,
      summaryLabel: 'Invalid check-in timestamp',
    };
  }

  const elapsedMs = Math.max(0, nowMs - checkInMs);
  const remainingMs = Math.max(0, VISITOR_AUTO_EXIT_MS - elapsedMs);
  const isOverdue = elapsedMs >= VISITOR_AUTO_EXIT_MS;
  const elapsedLabel = formatHoursMinutes(elapsedMs);
  const remainingLabel = isOverdue ? 'Overdue (12h+)' : `${formatHoursMinutes(remainingMs)} left`;
  const summaryLabel = isOverdue
    ? `${elapsedLabel} elapsed • Auto-exit due`
    : `${elapsedLabel} elapsed • ${remainingLabel}`;

  return {
    elapsedMs,
    remainingMs,
    isOverdue,
    elapsedLabel,
    remainingLabel,
    summaryLabel,
  };
}
