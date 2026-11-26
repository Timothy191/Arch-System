'use server';

import {
  bulkPrintCardsSchema,
  printCardRequestSchema,
} from '@repo/contract/schemas/access-control.schema';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter, RedisStore } from '@repo/rate-limiter';
import { cacheInvalidateTags, getRedisClient } from '@repo/redis';
import type { BadgesRow, IssuedCardsRow, PersonnelRow } from '@repo/supabase';
import { RawSocketBridge } from '@repo/utils';
import { revalidatePath } from 'next/cache';
import { DatabaseError, RateLimitError, ValidationError } from '@/lib/errors/error-classes';
import { sanitizePostgrestFilterValue } from '@/lib/supabase-filter';
import { assertAccessControlRoleFor } from '../actions/shared';
import { submitCupsPrintJob } from '../lib/printer-detection';

export interface PersonnelSearchResult {
  id: string;
  first_name: string;
  surname: string;
  id_number: string;
  job_title: string | null;
  area: string | null;
  status: string;
  department_id: string | null;
  has_badge: boolean;
}

export interface PersonnelDetail extends PersonnelRow {
  badge: Pick<BadgesRow, 'id' | 'qr_code' | 'is_active'> | null;
  issued_card: Pick<IssuedCardsRow, 'id' | 'status' | 'expires_at'> | null;
  photo_signed_url: string | null;
}

const CARD_ACTION_ROLES = ['admin', 'access_control'] as const;

function createCardPrintLimiter(): RateLimiter {
  try {
    const redis = getRedisClient();
    return new RateLimiter({
      store: redis ? new RedisStore(redis as never) : new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit: 30,
      windowMs: 60_000,
      keyPrefix: 'ratelimit:card_actions_print:',
    });
  } catch {
    return new RateLimiter({
      store: new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit: 30,
      windowMs: 60_000,
      keyPrefix: 'ratelimit:card_actions_print:',
    });
  }
}

const cardPrintLimiter = createCardPrintLimiter();

async function assertAccessCardActionsRole() {
  return assertAccessControlRoleFor({
    allowedRoles: CARD_ACTION_ROLES,
    resource: 'card_actions',
    forbiddenMessage: 'Forbidden: access_control or admin role required',
  });
}

export async function searchPersonnel(query: string): Promise<PersonnelSearchResult[]> {
  const { supabase } = await assertAccessCardActionsRole();

  if (!query || query.trim().length < 2) return [];

  const sanitizedQuery = sanitizePostgrestFilterValue(query);
  if (sanitizedQuery.length < 2) return [];

  const searchTerm = `%${sanitizedQuery}%`;

  const { data, error } = await supabase
    .from('personnel')
    .select(
      `
      id,
      first_name,
      surname,
      id_number,
      job_title,
      area,
      status,
      department_id,
      badges!left(id)
    `
    )
    .or(`first_name.ilike.${searchTerm},surname.ilike.${searchTerm},id_number.ilike.${searchTerm}`)
    .order('surname', { ascending: true })
    .limit(50);

  if (error) {
    throw new DatabaseError('Failed to search personnel', {
      cause: error,
      table: 'personnel',
    });
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    first_name: row.first_name,
    surname: row.surname,
    id_number: row.id_number,
    job_title: row.job_title,
    area: row.area,
    status: row.status,
    department_id: row.department_id,
    has_badge: Array.isArray(row.badges) && row.badges.length > 0,
  }));
}

export async function getPersonnelDetail(personnelId: string): Promise<PersonnelDetail | null> {
  const { supabase } = await assertAccessCardActionsRole();

  const { data: personnel, error } = await supabase
    .from('personnel')
    .select('*')
    .eq('id', personnelId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new DatabaseError('Failed to fetch personnel detail', {
      cause: error,
      table: 'personnel',
    });
  }
  if (!personnel) return null;

  const { data: badge } = await supabase
    .from('badges')
    .select('id, qr_code, is_active')
    .eq('personnel_id', personnelId)
    .maybeSingle();

  const { data: issuedCard } = await supabase
    .from('issued_cards')
    .select('id, status, expires_at')
    .eq('personnel_id', personnelId)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let photoSignedUrl: string | null = null;
  if (personnel.photo_url) {
    if (personnel.photo_url.startsWith('https://')) {
      photoSignedUrl = personnel.photo_url;
    } else if (!personnel.photo_url.startsWith('http')) {
      const { data: signedData } = await supabase.storage
        .from('personnel-photos')
        .createSignedUrl(personnel.photo_url, 3600);
      photoSignedUrl = signedData?.signedUrl ?? null;
    }
  }

  return {
    ...personnel,
    badge: badge ?? null,
    issued_card: issuedCard ?? null,
    photo_signed_url: photoSignedUrl,
  };
}

function buildCr80CardZpl(detail: PersonnelDetail, qrCode: string | null): string {
  const fullName = `${detail.first_name} ${detail.surname}`.replace(/[\^~]/g, '');
  const role = (detail.job_title ?? 'Personnel').replace(/[\^~]/g, '');
  const qr = (qrCode ?? detail.id).replace(/[\^~]/g, '');
  return `^XA^FO40,40^A0N,32,32^FD${fullName}^FS^FO40,85^A0N,22,22^FD${role}^FS^FO40,130^BQN,2,6^FDQA,${qr}^FS^XZ`;
}

export async function printCardForPersonnel(personnelId: string, templateId?: string) {
  const { supabase, employee, departmentId } = await assertAccessCardActionsRole();
  const parsed = printCardRequestSchema.safeParse({
    personnelId,
    templateId: templateId ?? null,
    printCopies: 1,
  });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid print card request');
  }

  const { allowed } = await cardPrintLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Print rate limit exceeded. Please wait.');
  }

  const detail = await getPersonnelDetail(parsed.data.personnelId);
  if (!detail) {
    throw new DatabaseError('Personnel not found', { table: 'personnel' });
  }

  const qrCode = detail.badge?.qr_code ?? null;

  const { data: printer } = await supabase
    .from('card_printers')
    .select('id, cups_name')
    .eq('status', 'online')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  const { data: job, error } = await supabase
    .from('print_jobs')
    .insert({
      personnel_id: parsed.data.personnelId,
      employee_name: `${detail.first_name} ${detail.surname}`,
      role_title: detail.job_title,
      qr_code_data: qrCode,
      status: 'queued',
      printer_id: printer?.id ?? null,
      template_id: parsed.data.templateId ?? null,
      created_by: employee.id,
      expires_at: detail.induction_expiry ?? undefined,
    })
    .select()
    .single();

  if (error) {
    throw new DatabaseError('Failed to create print job', {
      cause: error,
      table: 'print_jobs',
    });
  }

  let cupsJobId: number | null = null;
  if (printer?.cups_name) {
    try {
      const zplPayload = buildCr80CardZpl(detail, qrCode);
      if (printer.cups_name.startsWith('Zebra-') || printer.cups_name.startsWith('ZPL-')) {
        const host = process.env.PRINTER_HOST || '127.0.0.1';
        const bridge = new RawSocketBridge({ host, port: 9100, timeout: 5000 });
        await bridge.send(Buffer.from(zplPayload, 'utf8'));
      } else {
        const result = await submitCupsPrintJob(
          printer.cups_name,
          `card-${parsed.data.personnelId}`,
          zplPayload
        );
        cupsJobId = result.cupsJobId;
      }
    } catch {
      // On-prem bridge/CUPS unreachable from cloud — job remains queued for print bridge
    }
  }

  if (cupsJobId) {
    await supabase
      .from('print_jobs')
      .update({ cups_job_id: cupsJobId, status: 'sent_to_printer' })
      .eq('id', job.id);
  }

  logger.info({
    event: 'card_print_job_queued',
    actorId: employee.id,
    personnelId: parsed.data.personnelId,
    jobId: job.id,
    cupsJobId,
  });

  await cacheInvalidateTags([
    'table:print_jobs',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidatePath('/access-control/print-cards');

  return { job: { ...job, cups_job_id: cupsJobId }, printer };
}

export async function bulkPrintCardsForPersonnel(personnelIds: string[], templateId?: string) {
  await assertAccessCardActionsRole();

  const parsed = bulkPrintCardsSchema.safeParse({
    personnelIds,
    templateId: templateId ?? null,
  });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid bulk print payload');
  }

  const results = [];
  for (const id of parsed.data.personnelIds) {
    try {
      const res = await printCardForPersonnel(id, parsed.data.templateId ?? undefined);
      results.push({ id, status: 'success', data: res });
    } catch (err) {
      results.push({
        id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Print failed',
      });
    }
  }
  return results;
}

export async function getCardTemplates() {
  const { supabase } = await assertAccessCardActionsRole();
  const { data, error } = await supabase
    .from('card_templates')
    .select('id, name, description, layout, is_default, background')
    .is('deleted_at', null)
    .order('is_default', { ascending: false });

  if (error) {
    throw new DatabaseError('Failed to fetch card templates', {
      cause: error,
      table: 'card_templates',
    });
  }
  return data ?? [];
}
