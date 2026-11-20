'use server';

import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit';
import { updateTagInAction } from '@/lib/server-cache';

const OFFICE_WORKSPACE_CACHE_TAG = 'dept:office:workspace';
const OFFICE_ROUTE_PATH = '/office';
const OFFICE_AUDIT_TABLE = 'office_documents';
const OFFICE_AUDIT_QUERY_LIMIT = 20;
const SOP_BREAKDOWNS_LIMIT = 8;
const SOP_TIRES_LIMIT = 50;
const SOP_ACCESS_LOGS_LIMIT = 50;
const SOP_VISITORS_LIMIT = 30;
const SOP_DAILY_LOGS_LIMIT = 10;
const HOURS_24_MS = 86_400_000;
const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 140;
const MIN_SUMMARY_LENGTH = 5;
const MAX_SUMMARY_LENGTH = 2000;

export type OfficeDocumentType = 'document' | 'spreadsheet' | 'presentation';

export interface OfficeDocumentRecord {
  readonly id: string;
  readonly title: string;
  readonly docType: OfficeDocumentType;
  readonly summary: string;
  readonly updatedAt: string;
  readonly authorRole: string;
}

interface OfficeLabToolStatus {
  readonly id: 'genoffice' | 'inshellisense' | 'trail-code';
  readonly name: string;
  readonly version: string;
  readonly repositoryUrl: string;
  readonly status: 'online' | 'healthy';
  readonly capabilitySummary: string;
}

interface OfficeWorkspaceSnapshot {
  readonly departmentSlug: 'office';
  readonly syncedAt: string;
  readonly isAuthenticated: boolean;
  readonly documents: readonly OfficeDocumentRecord[];
  readonly labTools: readonly OfficeLabToolStatus[];
}

export interface OfficeSopBreakdownSummary {
  readonly id: string;
  readonly fleetLabel: string;
  readonly status: string;
  readonly reason: string;
  readonly delayHours: number;
  readonly dateIn: string;
}

export interface OfficeSopProtocolStep {
  readonly stepNumber: string;
  readonly stage: string;
  readonly requirement: string;
  readonly escalationOwner: string;
}

export interface OfficeSopReportRequest {
  readonly documentId?: string;
  readonly documentTitle?: string;
  readonly documentSummary?: string;
  readonly documentType?: OfficeDocumentType;
  readonly authorRole?: string;
  readonly updatedAt?: string;
}

export interface OfficeSopLiveReportData {
  readonly documentId: string;
  readonly documentTitle: string;
  readonly documentSummary: string;
  readonly documentType: OfficeDocumentType;
  readonly authorRole: string;
  readonly operationalDate: string;
  readonly generatedAtIso: string;
  readonly generatedAtFormatted: string;
  readonly dataSourceStatus: 'live_supabase' | 'template_baseline';
  readonly activeBreakdownsCount: number;
  readonly recent24hBreakdownsCount: number;
  readonly recentBreakdowns: readonly OfficeSopBreakdownSummary[];
  readonly installedTiresCount: number;
  readonly criticalTiresCount: number;
  readonly recentAccessScansCount: number;
  readonly checkedInVisitorsCount: number;
  readonly latestGateEvent: string;
  readonly recentDailyLogsCount: number;
  readonly latestShiftNote: string;
  readonly officeDocuments: readonly OfficeDocumentRecord[];
  readonly protocolSteps: readonly OfficeSopProtocolStep[];
}

type SaveOfficeDocumentResult =
  | {
      readonly status: 'success';
      readonly documentId: string;
      readonly savedAt: string;
      readonly document: OfficeDocumentRecord;
    }
  | {
      readonly status: 'error';
      readonly message: string;
    };

const SaveOfficeDocumentSchema = z.object({
  title: z.string().trim().min(MIN_TITLE_LENGTH).max(MAX_TITLE_LENGTH),
  docType: z.enum(['document', 'spreadsheet', 'presentation']),
  summary: z.string().trim().min(MIN_SUMMARY_LENGTH).max(MAX_SUMMARY_LENGTH),
});

const INITIAL_OFFICE_DOCUMENTS: readonly OfficeDocumentRecord[] = [
  {
    id: 'office-doc-shift-handover-sop',
    title: 'Executive Shift Handover & Safety Escalation SOP',
    docType: 'document',
    summary:
      'Standard operating procedure for cross-department shift handover, statutory safety sign-off, and control room escalation.',
    updatedAt: '2026-11-02T06:00:00.000Z',
    authorRole: 'Mine Operations Superintendent',
  },
  {
    id: 'office-sheet-yield-cost-model',
    title: 'Plant Dense Medium Yield & Cost per Tonne Model',
    docType: 'spreadsheet',
    summary:
      'Live financial and metallurgical spreadsheet modeling ROM feed tonnage, magnetite consumption, and washed coal yield targets.',
    updatedAt: '2026-11-02T07:30:00.000Z',
    authorRole: 'Senior Cost Accountant',
  },
  {
    id: 'office-deck-weekly-board-review',
    title: 'Weekly Executive Operations & Fleet Availability Deck',
    docType: 'presentation',
    summary:
      'Boardroom presentation summarizing 13-department KPIs, haulage availability, drilling meterage, and gate muster compliance.',
    updatedAt: '2026-11-02T08:15:00.000Z',
    authorRole: 'General Mine Manager',
  },
];

const INITIAL_OFFICE_LAB_TOOLS: readonly OfficeLabToolStatus[] = [
  {
    id: 'genoffice',
    name: 'GenOffice Online Suite',
    version: 'online',
    repositoryUrl: 'https://github.com/genspark-ai/genoffice',
    status: 'online',
    capabilitySummary:
      'AI-native online document writer, mining yield & cost spreadsheet modeler, and executive shift presentation deck studio.',
  },
  {
    id: 'inshellisense',
    name: 'Inshellisense Terminal IDE',
    version: '0.0.4',
    repositoryUrl: 'https://github.com/microsoft/inshellisense',
    status: 'healthy',
    capabilitySummary:
      'IDE-style command-line autocomplete runtime supporting bash, zsh, fish, and pwsh for Arch-System operational CLI workflows.',
  },
  {
    id: 'trail-code',
    name: 'Trail-Code Intelligence',
    version: '0.28.1',
    repositoryUrl: 'https://github.com/trailhq/Trail-Code',
    status: 'healthy',
    capabilitySummary:
      'Interactive codebase trail intelligence mapping Edge Proxy RBAC, Dual-Tier Redis L1/L2 caching, and Department Workspace routes.',
  },
];

const SOP_ESCALATION_PROTOCOL: readonly OfficeSopProtocolStep[] = [
  {
    stepNumber: '01',
    stage: 'Gate Muster & Alcohol Interlock',
    requirement:
      'Verify turnstile access_logs and active contractor visitors muster counts before shift authorization.',
    escalationOwner: 'Access Control Officer',
  },
  {
    stepNumber: '02',
    stage: 'Control Room SCADA & End-SMR Lock',
    requirement:
      'Confirm monotonic shift-end SMR readings and zero unacknowledged PLC alarm flags prior to closeout.',
    escalationOwner: 'Control Room Dispatcher',
  },
  {
    stepNumber: '03',
    stage: 'Engineering Breakdown & Tire Safety',
    requirement:
      'Escalate active mechanical/electrical breakdowns and critical tire tread or PSI alerts to dispatch.',
    escalationOwner: 'Engineering Superintendent',
  },
  {
    stepNumber: '04',
    stage: 'Daily Shift Log Reconciliation',
    requirement:
      'Reconcile department daily_logs handover notes across Drilling, Production, and CHPP Processing.',
    escalationOwner: 'Shift Supervisor',
  },
  {
    stepNumber: '05',
    stage: 'MHSA Sec. 11 Statutory Sign-Off',
    requirement:
      'Execute dual outgoing/incoming superintendent approval and archive signed PDF in Executive Dossier.',
    escalationOwner: 'Mine Operations Superintendent',
  },
];

const OfficeAuditPayloadSchema = SaveOfficeDocumentSchema.extend({
  savedAt: z.string().optional(),
});

interface OfficeAuditLogRow {
  readonly id: string;
  readonly record_id: string | null;
  readonly new_data: unknown;
  readonly created_at: string;
}

interface BreakdownRow {
  readonly id: string;
  readonly fleet_id?: string | null;
  readonly machine_name?: string | null;
  readonly status?: string | null;
  readonly reason?: string | null;
  readonly delay_hours?: number | null;
  readonly date_in?: string | null;
  readonly created_at?: string | null;
}

interface TireRow {
  readonly id: string;
  readonly status?: string | null;
}

interface AccessLogRow {
  readonly id: string;
  readonly direction?: string | null;
  readonly gate_location?: string | null;
  readonly access_granted?: boolean | null;
  readonly scanned_at?: string | null;
}

interface VisitorRow {
  readonly id: string;
  readonly status?: string | null;
  readonly check_in_time?: string | null;
  readonly check_out_time?: string | null;
}

interface DailyLogRow {
  readonly id: string;
  readonly shift?: string | null;
  readonly log_date?: string | null;
  readonly notes?: string | null;
}

function parseSavedOfficeDocuments(auditRows: unknown): readonly OfficeDocumentRecord[] {
  if (!Array.isArray(auditRows)) return INITIAL_OFFICE_DOCUMENTS;
  const seenIds = new Set<string>();
  const persistedDocs = auditRows.reduce<OfficeDocumentRecord[]>((acc, rawRow) => {
    const row = rawRow as OfficeAuditLogRow;
    const parsed = OfficeAuditPayloadSchema.safeParse(row.new_data);
    const docId = row.record_id ?? row.id;
    if (!parsed.success || seenIds.has(docId)) return acc;
    seenIds.add(docId);
    return [
      ...acc,
      {
        id: docId,
        title: parsed.data.title,
        docType: parsed.data.docType,
        summary: parsed.data.summary,
        updatedAt: parsed.data.savedAt ?? row.created_at,
        authorRole: 'Saved Office Record',
      },
    ];
  }, []);

  if (persistedDocs.length === 0) return INITIAL_OFFICE_DOCUMENTS;
  return [...persistedDocs, ...INITIAL_OFFICE_DOCUMENTS.filter((doc) => !seenIds.has(doc.id))];
}

export async function getOfficeWorkspaceSnapshot(): Promise<OfficeWorkspaceSnapshot> {
  let isAuthenticated = false;
  let documents: readonly OfficeDocumentRecord[] = INITIAL_OFFICE_DOCUMENTS;

  try {
    const supabase = await createServerSupabaseClient();
    const authResponse = await supabase.auth.getUser();
    isAuthenticated = Boolean(authResponse.data?.user && !authResponse.error);

    if (isAuthenticated && typeof supabase.from === 'function') {
      const { data: auditRows, error: auditError } = await supabase
        .from('audit_logs')
        .select('id, record_id, new_data, created_at')
        .eq('table_name', OFFICE_AUDIT_TABLE)
        .order('created_at', { ascending: false })
        .limit(OFFICE_AUDIT_QUERY_LIMIT);

      if (!auditError) {
        documents = parseSavedOfficeDocuments(auditRows);
      }
    }
  } catch {
    isAuthenticated = false;
  }

  return {
    departmentSlug: 'office',
    syncedAt: new Date().toISOString(),
    isAuthenticated,
    documents,
    labTools: INITIAL_OFFICE_LAB_TOOLS,
  };
}

function summarizeBreakdowns(rows: readonly BreakdownRow[], nowMs: number) {
  const closedStatuses = new Set(['resolved', 'closed', 'completed']);
  const activeRows = rows.filter(
    (row) => !closedStatuses.has(String(row.status ?? 'active').toLowerCase())
  );
  const recent24hCount = rows.filter((row) => {
    const ts = row.created_at ?? row.date_in;
    if (!ts) return false;
    const parsedMs = Date.parse(ts);
    return Number.isFinite(parsedMs) && nowMs - parsedMs <= HOURS_24_MS;
  }).length;

  const recentBreakdowns: OfficeSopBreakdownSummary[] = rows.slice(0, 6).map((row) => ({
    id: row.id,
    fleetLabel: row.machine_name?.trim() || row.fleet_id?.trim() || 'Fleet Unit',
    status: row.status?.trim() || 'open',
    reason: row.reason?.trim() || 'Scheduled inspection / fault logged',
    delayHours: Number(row.delay_hours ?? 0),
    dateIn: row.date_in?.slice(0, 10) ?? row.created_at?.slice(0, 10) ?? 'Current Shift',
  }));

  return {
    activeBreakdownsCount: activeRows.length,
    recent24hBreakdownsCount: recent24hCount,
    recentBreakdowns,
  };
}

function summarizeTires(rows: readonly TireRow[]) {
  const criticalStatuses = new Set(['critical', 'damaged', 'warning', 'condemned']);
  const retiredStatuses = new Set(['scrapped', 'retired', 'removed']);
  let installedCount = 0;
  let criticalCount = 0;

  for (const row of rows) {
    const normalized = String(row.status ?? 'installed').toLowerCase();
    if (!retiredStatuses.has(normalized)) installedCount += 1;
    if (criticalStatuses.has(normalized)) criticalCount += 1;
  }

  return { installedTiresCount: installedCount, criticalTiresCount: criticalCount };
}

function summarizeGateAndVisitors(
  accessRows: readonly AccessLogRow[],
  visitorRows: readonly VisitorRow[]
) {
  const checkedInVisitorsCount = visitorRows.filter((visitor) => {
    const status = String(visitor.status ?? '').toLowerCase();
    if (status === 'checked_in' || status === 'on_site' || status === 'active') return true;
    return Boolean(visitor.check_in_time && !visitor.check_out_time);
  }).length;

  const latestScan = accessRows[0];
  const latestGateEvent = latestScan
    ? `${latestScan.direction ?? 'IN'} · ${latestScan.gate_location ?? 'Main Gate'} (${
        latestScan.access_granted === false ? 'Denied' : 'Granted'
      })`
    : 'No turnstile scan anomalies logged';

  return {
    recentAccessScansCount: accessRows.length,
    checkedInVisitorsCount,
    latestGateEvent,
  };
}

function summarizeDailyLogs(rows: readonly DailyLogRow[]) {
  const latestLog = rows[0];
  const latestShiftNote = latestLog
    ? `[${latestLog.log_date ?? 'Current'} · ${latestLog.shift ?? 'Day'}] ${
        latestLog.notes?.trim() || 'Shift handover log recorded.'
      }`
    : 'No supplementary daily shift notes logged for current cycle.';

  return {
    recentDailyLogsCount: rows.length,
    latestShiftNote,
  };
}

export async function getOfficeSopLiveReportData(
  request?: OfficeSopReportRequest
): Promise<OfficeSopLiveReportData> {
  const defaultSop = INITIAL_OFFICE_DOCUMENTS[0]!;
  const nowDate = new Date();
  const nowMs = nowDate.getTime();
  const generatedAtIso = nowDate.toISOString();
  const operationalDate = generatedAtIso.slice(0, 10);
  const generatedAtFormatted = nowDate.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  let dataSourceStatus: 'live_supabase' | 'template_baseline' = 'template_baseline';
  let activeBreakdownsCount = 0;
  let recent24hBreakdownsCount = 0;
  let recentBreakdowns: readonly OfficeSopBreakdownSummary[] = [];
  let installedTiresCount = 0;
  let criticalTiresCount = 0;
  let recentAccessScansCount = 0;
  let checkedInVisitorsCount = 0;
  let latestGateEvent = 'Baseline gate muster ready — awaiting live scan sync';
  let recentDailyLogsCount = 0;
  let latestShiftNote =
    'Baseline SOP template active — complete live shift notes prior to sign-off.';
  let officeDocuments: readonly OfficeDocumentRecord[] = INITIAL_OFFICE_DOCUMENTS;

  try {
    const supabase = await createServerSupabaseClient();
    const authResponse = await supabase.auth.getUser();
    const isAuthenticated = Boolean(authResponse.data?.user && !authResponse.error);

    if (isAuthenticated && typeof supabase.from === 'function') {
      const [breakdownsRes, tiresRes, accessRes, visitorsRes, dailyLogsRes, officeAuditRes] =
        await Promise.allSettled([
          supabase
            .from('breakdowns')
            .select('id, fleet_id, machine_name, status, reason, delay_hours, date_in, created_at')
            .order('created_at', { ascending: false })
            .limit(SOP_BREAKDOWNS_LIMIT),
          supabase.from('tires').select('id, status').limit(SOP_TIRES_LIMIT),
          supabase
            .from('access_logs')
            .select('id, direction, gate_location, access_granted, scanned_at')
            .order('scanned_at', { ascending: false })
            .limit(SOP_ACCESS_LOGS_LIMIT),
          supabase
            .from('visitors')
            .select('id, status, check_in_time, check_out_time')
            .order('check_in_time', { ascending: false })
            .limit(SOP_VISITORS_LIMIT),
          supabase
            .from('daily_logs')
            .select('id, shift, log_date, notes')
            .order('created_at', { ascending: false })
            .limit(SOP_DAILY_LOGS_LIMIT),
          supabase
            .from('audit_logs')
            .select('id, record_id, new_data, created_at')
            .eq('table_name', OFFICE_AUDIT_TABLE)
            .order('created_at', { ascending: false })
            .limit(OFFICE_AUDIT_QUERY_LIMIT),
        ]);

      let hadSuccessfulQuery = false;

      if (breakdownsRes.status === 'fulfilled' && !breakdownsRes.value.error) {
        hadSuccessfulQuery = true;
        const summary = summarizeBreakdowns(
          (breakdownsRes.value.data ?? []) as BreakdownRow[],
          nowMs
        );
        activeBreakdownsCount = summary.activeBreakdownsCount;
        recent24hBreakdownsCount = summary.recent24hBreakdownsCount;
        recentBreakdowns = summary.recentBreakdowns;
      }

      if (tiresRes.status === 'fulfilled' && !tiresRes.value.error) {
        hadSuccessfulQuery = true;
        const summary = summarizeTires((tiresRes.value.data ?? []) as TireRow[]);
        installedTiresCount = summary.installedTiresCount;
        criticalTiresCount = summary.criticalTiresCount;
      }

      const accessRows =
        accessRes.status === 'fulfilled' && !accessRes.value.error
          ? ((accessRes.value.data ?? []) as AccessLogRow[])
          : [];
      const visitorRows =
        visitorsRes.status === 'fulfilled' && !visitorsRes.value.error
          ? ((visitorsRes.value.data ?? []) as VisitorRow[])
          : [];
      if (
        (accessRes.status === 'fulfilled' && !accessRes.value.error) ||
        (visitorsRes.status === 'fulfilled' && !visitorsRes.value.error)
      ) {
        hadSuccessfulQuery = true;
        const gateSummary = summarizeGateAndVisitors(accessRows, visitorRows);
        recentAccessScansCount = gateSummary.recentAccessScansCount;
        checkedInVisitorsCount = gateSummary.checkedInVisitorsCount;
        latestGateEvent = gateSummary.latestGateEvent;
      }

      if (dailyLogsRes.status === 'fulfilled' && !dailyLogsRes.value.error) {
        hadSuccessfulQuery = true;
        const logSummary = summarizeDailyLogs((dailyLogsRes.value.data ?? []) as DailyLogRow[]);
        recentDailyLogsCount = logSummary.recentDailyLogsCount;
        latestShiftNote = logSummary.latestShiftNote;
      }

      if (officeAuditRes.status === 'fulfilled' && !officeAuditRes.value.error) {
        hadSuccessfulQuery = true;
        officeDocuments = parseSavedOfficeDocuments(officeAuditRes.value.data);
      }

      if (hadSuccessfulQuery) {
        dataSourceStatus = 'live_supabase';
      }
    }
  } catch {
    dataSourceStatus = 'template_baseline';
  }

  return {
    documentId: request?.documentId ?? defaultSop.id,
    documentTitle: request?.documentTitle ?? defaultSop.title,
    documentSummary: request?.documentSummary ?? defaultSop.summary,
    documentType: request?.documentType ?? defaultSop.docType,
    authorRole: request?.authorRole ?? defaultSop.authorRole,
    operationalDate,
    generatedAtIso,
    generatedAtFormatted,
    dataSourceStatus,
    activeBreakdownsCount,
    recent24hBreakdownsCount,
    recentBreakdowns,
    installedTiresCount,
    criticalTiresCount,
    recentAccessScansCount,
    checkedInVisitorsCount,
    latestGateEvent,
    recentDailyLogsCount,
    latestShiftNote,
    officeDocuments,
    protocolSteps: SOP_ESCALATION_PROTOCOL,
  };
}

export async function saveOfficeDocumentAction(
  rawInput: unknown
): Promise<SaveOfficeDocumentResult> {
  const supabase = await createServerSupabaseClient();
  const authResponse = await supabase.auth.getUser();
  const authenticatedUser = authResponse.data?.user ?? null;

  if (authResponse.error || !authenticatedUser) {
    return {
      status: 'error',
      message: 'Unauthorized: active operator session required',
    };
  }

  const parsedInput = SaveOfficeDocumentSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    const validationIssue = parsedInput.error.issues[0];
    return {
      status: 'error',
      message: validationIssue?.message ?? 'Invalid office document payload',
    };
  }

  const savedAt = new Date().toISOString();
  const documentId = `office-${parsedInput.data.docType}-${Date.now()}`;
  const createdDocument: OfficeDocumentRecord = {
    id: documentId,
    title: parsedInput.data.title,
    docType: parsedInput.data.docType,
    summary: parsedInput.data.summary,
    updatedAt: savedAt,
    authorRole: authenticatedUser.email ?? 'Authenticated Operator',
  };

  await logAuditEvent({
    action: 'insert',
    tableName: OFFICE_AUDIT_TABLE,
    recordId: documentId,
    newData: {
      title: createdDocument.title,
      docType: createdDocument.docType,
      summary: createdDocument.summary,
      savedAt,
    },
  });

  await updateTagInAction(OFFICE_WORKSPACE_CACHE_TAG);
  revalidatePath(OFFICE_ROUTE_PATH);

  return {
    status: 'success',
    documentId,
    savedAt,
    document: createdDocument,
  };
}
