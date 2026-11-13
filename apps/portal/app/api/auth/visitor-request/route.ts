import { randomBytes } from 'node:crypto';
import { type VisitorPassRequestInput, visitorPassRequestSchema } from '@repo/contract';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { logError } from '@/lib/errors/error-logger';

const MAX_REQUEST_BODY_BYTES = 16_384;
const QR_CODE_SUFFIX_LENGTH = 6;
const PASS_VALIDITY_MS = 86_400_000; // 24 hours
const QR_ALPHABET = 'A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z,2,3,4,5,6,7,8,9'.split(',');

const STATUS_OK = 200;
const STATUS_CREATED = 201;
const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;
const STATUS_CONFLICT = 409;
const STATUS_UNSUPPORTED_MEDIA = 415;
const STATUS_INTERNAL_ERROR = 500;

const ACCESS_CONTROL_TAG = 'access-control';
const PRE_REGISTERED_STATUS = 'Pre-Registered';
const CHECKED_IN_STATUS = 'Checked In';

type ServiceSupabaseClient = ReturnType<typeof createServiceRoleClient>;

interface PersistedVisitorRecord {
  readonly id: string;
  readonly firstName: string;
  readonly surname: string;
  readonly company: string;
  readonly visiting: string;
  readonly status: typeof PRE_REGISTERED_STATUS;
  readonly isExistingReuse: boolean;
}

type VisitorUpsertOutcome =
  | { readonly kind: 'conflict_checked_in' }
  | { readonly kind: 'persisted'; readonly visitor: PersistedVisitorRecord };

interface PersistedBadgeRecord {
  readonly qrCode: string;
  readonly expiresAt: string;
  readonly isReusedBadge: boolean;
}

function generateVisitorQrCode(): string {
  const randomBuffer = randomBytes(QR_CODE_SUFFIX_LENGTH);
  let suffix = '';
  for (let idx = 0; idx < QR_CODE_SUFFIX_LENGTH; idx += 1) {
    const byteEntry = randomBuffer[idx] ?? 0;
    suffix += QR_ALPHABET[byteEntry % QR_ALPHABET.length] ?? 'A';
  }
  return `VIS-${suffix}`;
}

function resolveHostOrigin(request: NextRequest): string | null {
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!hostHeader) {
    return null;
  }
  const protocolPrefix = hostHeader.includes('localhost') ? 'http' : 'https';
  return `${protocolPrefix}://${hostHeader}`;
}

function isOriginPermitted(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredAppUrl) {
    return true;
  }

  let expectedAppOrigin: string;
  try {
    expectedAppOrigin = new URL(configuredAppUrl).origin;
  } catch {
    return false;
  }

  const hostOrigin = resolveHostOrigin(request);
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin) {
    return requestOrigin === expectedAppOrigin || requestOrigin === hostOrigin;
  }

  const requestReferer = request.headers.get('referer');
  if (!requestReferer) {
    return false;
  }

  try {
    const parsedRefererOrigin = new URL(requestReferer).origin;
    return parsedRefererOrigin === expectedAppOrigin || parsedRefererOrigin === hostOrigin;
  } catch {
    return false;
  }
}

async function resolveOptionalCallerUserId(): Promise<string | null> {
  try {
    const sessionSupabase = await createServerSupabaseClient();
    const callerUser = await getUserSafely(sessionSupabase);
    return typeof callerUser?.id === 'string' && callerUser.id.length > 0 ? callerUser.id : null;
  } catch {
    return null;
  }
}

async function resolveAccessControlDeptId(supabase: ServiceSupabaseClient): Promise<string | null> {
  const { data: departmentRow } = await supabase
    .from('departments')
    .select('id')
    .eq('name', ACCESS_CONTROL_TAG)
    .maybeSingle();

  return typeof departmentRow?.id === 'string' ? departmentRow.id : null;
}

function isMissingLegacyVisitorColumn(
  dbError: { readonly code?: string; readonly message?: string } | null
): boolean {
  if (!dbError) {
    return false;
  }
  const errorMessage = dbError.message ?? '';
  return (
    dbError.code === 'PGRST204' ||
    errorMessage.includes('column "name"') ||
    errorMessage.includes('column "purpose"')
  );
}

async function insertVisitorRow(
  supabase: ServiceSupabaseClient,
  options: {
    readonly validatedInput: VisitorPassRequestInput;
    readonly departmentId: string | null;
    readonly hostUserId: string | null;
  }
): Promise<PersistedVisitorRecord> {
  const { validatedInput, departmentId, hostUserId } = options;
  const fullName = `${validatedInput.first_name} ${validatedInput.surname}`;

  const primaryPayload: Record<string, unknown> = {
    name: fullName,
    first_name: validatedInput.first_name,
    surname: validatedInput.surname,
    id_number: validatedInput.id_number,
    company: validatedInput.company,
    visiting: validatedInput.visiting,
    purpose: validatedInput.reason_for_entry,
    reason_for_entry: validatedInput.reason_for_entry,
    department_id: departmentId,
    host_user_id: hostUserId,
    status: PRE_REGISTERED_STATUS,
    check_in_time: null,
  };

  const primaryInsert = await supabase.from('visitors').insert(primaryPayload).select().single();
  if (!primaryInsert.error && primaryInsert.data) {
    return {
      id: String(primaryInsert.data.id),
      firstName: validatedInput.first_name,
      surname: validatedInput.surname,
      company: validatedInput.company,
      visiting: validatedInput.visiting,
      status: PRE_REGISTERED_STATUS,
      isExistingReuse: false,
    };
  }

  if (!isMissingLegacyVisitorColumn(primaryInsert.error)) {
    throw new Error(primaryInsert.error?.message || 'Failed to insert visitor record');
  }

  const modernPayload: Record<string, unknown> = {
    first_name: validatedInput.first_name,
    surname: validatedInput.surname,
    id_number: validatedInput.id_number,
    company: validatedInput.company,
    visiting: validatedInput.visiting,
    reason_for_entry: validatedInput.reason_for_entry,
    department_id: departmentId,
    status: PRE_REGISTERED_STATUS,
    check_in_time: null,
  };

  const fallbackInsert = await supabase.from('visitors').insert(modernPayload).select().single();
  if (fallbackInsert.error || !fallbackInsert.data) {
    throw new Error(fallbackInsert.error?.message || 'Failed to insert modern visitor record');
  }

  return {
    id: String(fallbackInsert.data.id),
    firstName: validatedInput.first_name,
    surname: validatedInput.surname,
    company: validatedInput.company,
    visiting: validatedInput.visiting,
    status: PRE_REGISTERED_STATUS,
    isExistingReuse: false,
  };
}

async function updateExistingVisitorRow(
  supabase: ServiceSupabaseClient,
  options: {
    readonly existingId: string;
    readonly validatedInput: VisitorPassRequestInput;
    readonly departmentId: string | null;
  }
): Promise<PersistedVisitorRecord> {
  const { existingId, validatedInput, departmentId } = options;
  const fullName = `${validatedInput.first_name} ${validatedInput.surname}`;

  const primaryPayload: Record<string, unknown> = {
    name: fullName,
    first_name: validatedInput.first_name,
    surname: validatedInput.surname,
    company: validatedInput.company,
    visiting: validatedInput.visiting,
    purpose: validatedInput.reason_for_entry,
    reason_for_entry: validatedInput.reason_for_entry,
    department_id: departmentId,
    status: PRE_REGISTERED_STATUS,
    check_in_time: null,
    check_out_time: null,
  };

  const primaryUpdate = await supabase
    .from('visitors')
    .update(primaryPayload)
    .eq('id', existingId)
    .select()
    .single();

  if (!primaryUpdate.error && primaryUpdate.data) {
    return {
      id: String(primaryUpdate.data.id),
      firstName: validatedInput.first_name,
      surname: validatedInput.surname,
      company: validatedInput.company,
      visiting: validatedInput.visiting,
      status: PRE_REGISTERED_STATUS,
      isExistingReuse: true,
    };
  }

  if (!isMissingLegacyVisitorColumn(primaryUpdate.error)) {
    throw new Error(primaryUpdate.error?.message || 'Failed to update repeat visitor record');
  }

  const modernPayload: Record<string, unknown> = {
    first_name: validatedInput.first_name,
    surname: validatedInput.surname,
    company: validatedInput.company,
    visiting: validatedInput.visiting,
    reason_for_entry: validatedInput.reason_for_entry,
    department_id: departmentId,
    status: PRE_REGISTERED_STATUS,
    check_in_time: null,
    check_out_time: null,
  };

  const fallbackUpdate = await supabase
    .from('visitors')
    .update(modernPayload)
    .eq('id', existingId)
    .select()
    .single();

  if (fallbackUpdate.error || !fallbackUpdate.data) {
    throw new Error(fallbackUpdate.error?.message || 'Failed to update modern visitor record');
  }

  return {
    id: String(fallbackUpdate.data.id),
    firstName: validatedInput.first_name,
    surname: validatedInput.surname,
    company: validatedInput.company,
    visiting: validatedInput.visiting,
    status: PRE_REGISTERED_STATUS,
    isExistingReuse: true,
  };
}

async function upsertPreRegisteredVisitor(
  supabase: ServiceSupabaseClient,
  options: {
    readonly validatedInput: VisitorPassRequestInput;
    readonly departmentId: string | null;
    readonly hostUserId: string | null;
  }
): Promise<VisitorUpsertOutcome> {
  const { validatedInput, departmentId, hostUserId } = options;

  if (validatedInput.id_number) {
    const { data: existingRow } = await supabase
      .from('visitors')
      .select('id, status')
      .eq('id_number', validatedInput.id_number)
      .maybeSingle();

    if (existingRow?.id) {
      if (existingRow.status === CHECKED_IN_STATUS) {
        return { kind: 'conflict_checked_in' };
      }

      const updatedVisitor = await updateExistingVisitorRow(supabase, {
        existingId: String(existingRow.id),
        validatedInput,
        departmentId,
      });

      return { kind: 'persisted', visitor: updatedVisitor };
    }
  }

  const insertedVisitor = await insertVisitorRow(supabase, {
    validatedInput,
    departmentId,
    hostUserId,
  });
  return { kind: 'persisted', visitor: insertedVisitor };
}

async function resolveOrCreateVisitorBadge(
  supabase: ServiceSupabaseClient,
  options: {
    readonly visitorId: string;
    readonly departmentId: string | null;
    readonly shouldCheckExistingBadge: boolean;
  }
): Promise<PersistedBadgeRecord> {
  const nowIso = new Date().toISOString();

  if (options.shouldCheckExistingBadge) {
    const { data: activeBadge } = await supabase
      .from('badges')
      .select('id, qr_code, expires_at')
      .eq('visitor_id', options.visitorId)
      .eq('is_active', true)
      .gt('expires_at', nowIso)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeBadge?.qr_code && activeBadge.expires_at) {
      return {
        qrCode: String(activeBadge.qr_code),
        expiresAt: String(activeBadge.expires_at),
        isReusedBadge: true,
      };
    }
  }

  const generatedQrCode = generateVisitorQrCode();
  const expiresAtIso = new Date(Date.now() + PASS_VALIDITY_MS).toISOString();

  const { data: createdBadge, error: badgeInsertError } = await supabase
    .from('badges')
    .insert({
      qr_code: generatedQrCode,
      entity_type: 'visitor',
      visitor_id: options.visitorId,
      department_id: options.departmentId,
      is_active: true,
      issued_at: nowIso,
      expires_at: expiresAtIso,
    })
    .select()
    .single();

  if (badgeInsertError || !createdBadge) {
    throw new Error(badgeInsertError?.message || 'Failed to issue pending visitor badge');
  }

  return {
    qrCode: String(createdBadge.qr_code),
    expiresAt: String(createdBadge.expires_at ?? expiresAtIso),
    isReusedBadge: false,
  };
}

async function handleVisitorPassPost(request: NextRequest): Promise<NextResponse> {
  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request body' },
      { status: STATUS_BAD_REQUEST }
    );
  }

  const validation = visitorPassRequestSchema.safeParse(rawPayload);
  if (!validation.success) {
    const firstIssueMessage =
      validation.error.issues[0]?.message ?? 'Invalid visitor request fields';
    return NextResponse.json(
      { success: false, error: firstIssueMessage },
      { status: STATUS_BAD_REQUEST }
    );
  }

  try {
    const [hostUserId, supabase] = await Promise.all([
      resolveOptionalCallerUserId(),
      Promise.resolve(createServiceRoleClient()),
    ]);
    const accessControlDeptId = await resolveAccessControlDeptId(supabase);

    const upsertOutcome = await upsertPreRegisteredVisitor(supabase, {
      validatedInput: validation.data,
      departmentId: accessControlDeptId,
      hostUserId,
    });

    if (upsertOutcome.kind === 'conflict_checked_in') {
      return NextResponse.json(
        {
          success: false,
          error:
            'A visitor with this ID or Passport is already checked in on site. Please report to gate security.',
        },
        { status: STATUS_CONFLICT }
      );
    }

    const visitorRecord = upsertOutcome.visitor;

    const badgeRecord = await resolveOrCreateVisitorBadge(supabase, {
      visitorId: visitorRecord.id,
      departmentId: accessControlDeptId,
      shouldCheckExistingBadge: visitorRecord.isExistingReuse,
    });

    revalidateTag(ACCESS_CONTROL_TAG, 'max');

    const httpStatus = badgeRecord.isReusedBadge ? STATUS_OK : STATUS_CREATED;
    return NextResponse.json(
      {
        success: true,
        pass: {
          qrCode: badgeRecord.qrCode,
          visitorId: visitorRecord.id,
          fullName: `${visitorRecord.firstName} ${visitorRecord.surname}`,
          company: visitorRecord.company,
          visiting: visitorRecord.visiting,
          status: visitorRecord.status,
          expiresAt: badgeRecord.expiresAt,
        },
      },
      { status: httpStatus }
    );
  } catch (caughtError) {
    await logError(caughtError, {
      url: request.url,
      method: request.method,
      operation: 'visitor_pass_request',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to submit visitor pass request right now. Please report to gate security.',
      },
      { status: STATUS_INTERNAL_ERROR }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { success: false, error: 'Content-Type must be application/json' },
      { status: STATUS_UNSUPPORTED_MEDIA }
    );
  }

  if (!isOriginPermitted(request)) {
    return NextResponse.json(
      { success: false, error: 'Invalid request origin' },
      { status: STATUS_FORBIDDEN }
    );
  }

  return withBodyLimit(
    request,
    () => withRateLimit(request, () => handleVisitorPassPost(request)),
    {
      maxSize: MAX_REQUEST_BODY_BYTES,
    }
  );
}
