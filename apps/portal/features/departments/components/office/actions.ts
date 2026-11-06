'use server';

import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit';
import { updateTagInAction } from '@/lib/server-cache';

const OFFICE_WORKSPACE_CACHE_TAG = 'dept:office:workspace';
const OFFICE_ROUTE_PATH = '/office';
const OFFICE_AUDIT_TABLE = 'office_documents';
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

export async function getOfficeWorkspaceSnapshot(): Promise<OfficeWorkspaceSnapshot> {
  let isAuthenticated = false;
  try {
    const supabase = await createServerSupabaseClient();
    const authResponse = await supabase.auth.getUser();
    isAuthenticated = Boolean(authResponse.data?.user && !authResponse.error);
  } catch {
    isAuthenticated = false;
  }

  return {
    departmentSlug: 'office',
    syncedAt: new Date().toISOString(),
    isAuthenticated,
    documents: INITIAL_OFFICE_DOCUMENTS,
    labTools: INITIAL_OFFICE_LAB_TOOLS,
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
