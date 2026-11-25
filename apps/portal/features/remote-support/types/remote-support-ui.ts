import type {
  RemoteSupportAuditEventsRow,
  RemoteSupportDevicesRow,
  RemoteSupportSessionsRow,
} from '@repo/supabase';

export interface SupportSessionView extends RemoteSupportSessionsRow {
  readonly requesterName?: string | null;
  readonly agentName?: string | null;
}

export interface SupportDeviceView extends RemoteSupportDevicesRow {
  readonly siteName?: string | null;
  readonly departmentName?: string | null;
  readonly assignedEmployeeName?: string | null;
}

export interface SupportAuditEventView extends RemoteSupportAuditEventsRow {
  readonly actorName?: string | null;
  readonly sessionCode?: string | null;
}
