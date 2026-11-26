import { randomBytes } from 'node:crypto';
import { type VisitorPassRequestInput, visitorPassRequestSchema } from '@repo/contract';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
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

const STATUS_CREATED = 201;
const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;
const STATUS_UNSUPPORTED_MEDIA = 415;
const STATUS_INTERNAL_ERROR = 500;

const ACCESS_CONTROL_TAG = 'access-control';
const PRE_REGISTERED_STATUS = 'Pre-Registered';

type ServiceSupabaseClient = ReturnType<typeof createServiceRoleClient>;

interface PersistedVisitorRecord {
  readonly id: string;
  readonly firstName: string;
  readonly surname: string;
  readonly company: string;
  readonly visiting: string;
  readonly status: typeof PRE_REGISTERED_STATUS;
}

interface PersistedBadgeRecord {
  readonly qrCode: string;
  readonly expiresAt: string;
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

function isOriginPermitted(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredAppUrl) {
    return false;
  }

  let expectedAppOrigin: string;
  try {
    expectedAppOrigin = new URL(configuredAppUrl).origin;
  } catch {
    return false;
  }

  const serverOrigin = request.nextUrl?.origin ?? expectedAppOrigin;
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin) {
    return requestOrigin === expectedAppOrigin || requestOrigin === serverOrigin;
  }

  const requestReferer = request.headers.get('referer');
  if (!requestReferer) {
    return false;
  }

  try {
    const parsedRefererOrigin = new URL(requestReferer).origin;
    return parsedRefererOrigin === expectedAppOrigin || parsedRefererOrigin === serverOrigin;
  } catch {
    return false;
  }
}

async function resolveOptionalHostEmployeeId(): Promise<string | null> {
  try {
    const sessionSupabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(sessionSupabase);
    return principal?.employee?.id ?? null;
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

async function insertImmutableVisitorRequest(
  supabase: ServiceSupabaseClient,
  options: {
    readonly validatedInput: VisitorPassRequestInput;
    readonly departmentId: string | null;
    readonly hostEmployeeId: string | null;
  }
): Promise<PersistedVisitorRecord> {
  const { validatedInput, departmentId, hostEmployeeId } = options;
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
    host_user_id: hostEmployeeId,
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
    host_user_id: hostEmployeeId,
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
  };
}

async function createPendingVisitorBadge(
  supabase: ServiceSupabaseClient,
  options: {
    readonly visitorId: string;
    readonly departmentId: string | null;
  }
): Promise<PersistedBadgeRecord> {
  const nowIso = new Date().toISOString();
  const generatedQrCode = generateVisitorQrCode();
  const expiresAtIso = new Date(Date.now() + PASS_VALIDITY_MS).toISOString();

  // Badge starts inactive until approved & checked in at the gatehouse.
  const { data: createdBadge, error: badgeInsertError } = await supabase
    .from('badges')
    .insert({
      qr_code: generatedQrCode,
      entity_type: 'visitor',
      visitor_id: options.visitorId,
      department_id: options.departmentId,
      is_active: false,
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
    const [hostEmployeeId, supabase] = await Promise.all([
      resolveOptionalHostEmployeeId(),
      Promise.resolve(createServiceRoleClient()),
    ]);
    const accessControlDeptId = await resolveAccessControlDeptId(supabase);

    const visitorRecord = await insertImmutableVisitorRequest(supabase, {
      validatedInput: validation.data,
      departmentId: accessControlDeptId,
      hostEmployeeId,
    });

    const badgeRecord = await createPendingVisitorBadge(supabase, {
      visitorId: visitorRecord.id,
      departmentId: accessControlDeptId,
    });

    revalidateTag(ACCESS_CONTROL_TAG, 'max');
    await cacheInvalidateTags([
      'table:visitors',
      'table:badges',
      ...(accessControlDeptId ? [`dept:${accessControlDeptId}`] : []),
    ]).catch(() => undefined);

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
      { status: STATUS_CREATED }
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
