export type AccessLogCategory =
  | 'ALL'
  | 'employees'
  | 'contractors'
  | 'fleet-machines'
  | 'fleet-ldv'
  | 'fleet-personal'
  | 'fleet-coal-trucks';

export interface ClassifiableAccessLogRow {
  readonly access_type?: string | null;
  readonly badge?: {
    readonly entity_type?: string | null;
    readonly access_type?: string | null;
    readonly personnel?: {
      readonly job_title?: string | null;
    } | null;
    readonly visitor?: unknown | null;
    readonly fleet?: {
      readonly fleet_code?: string | null;
      readonly vehicle_type?: string | null;
    } | null;
  } | null;
}

/**
 * Classifies an access log row into one of the 6 operational Access Logs sub-tabs.
 */
export function classifyAccessLogCategory(
  logRow: ClassifiableAccessLogRow
): Exclude<AccessLogCategory, 'ALL'> {
  const badge = logRow.badge;
  const rawEntityType = (badge?.entity_type ?? '').trim().toLowerCase();
  const rawAccessType = (logRow.access_type ?? '').trim().toLowerCase();

  if (badge?.fleet || rawEntityType === 'fleet' || rawEntityType === 'vehicle') {
    const descriptor =
      `${badge?.fleet?.vehicle_type ?? ''} ${badge?.fleet?.fleet_code ?? ''} ${rawAccessType}`.toLowerCase();
    if (/(coal|haul|adt|dump|tipper|truck)/.test(descriptor)) {
      return 'fleet-coal-trucks';
    }
    if (/(personal|private|employee vehicle|staff vehicle|sedan|hatchback|suv)/.test(descriptor)) {
      return 'fleet-personal';
    }
    if (/(ldv|company|service|utility|bowser|support|bus|van|pickup|bakkie)/.test(descriptor)) {
      return 'fleet-ldv';
    }
    return 'fleet-machines';
  }

  const jobLower = (badge?.personnel?.job_title ?? '').toLowerCase();
  if (
    badge?.visitor ||
    rawEntityType === 'visitor' ||
    rawEntityType === 'contractor' ||
    jobLower.includes('contractor')
  ) {
    return 'contractors';
  }

  return 'employees';
}
