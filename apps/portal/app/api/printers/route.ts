import { registerPrinterSchema } from '@repo/contract/schemas/access-control.schema';
import { logger } from '@repo/logger/server';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createBearerSupabaseClient, createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

const PRINTER_ROLES = new Set(['admin', 'access_control']);

function getBearerClient(request?: NextRequest) {
  const authHeader = request?.headers?.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return createBearerSupabaseClient(token);
  }
  return null;
}

type PrinterAuthClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function authorizePrinterRequest(request?: NextRequest): Promise<
  | {
      ok: true;
      supabase: PrinterAuthClient;
      userId: string;
      employeeId: string;
      role: string;
    }
  | { ok: false; response: NextResponse }
> {
  const supabase = getBearerClient(request) || (await createServerSupabaseClient());
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
        { status: 401 }
      ),
    };
  }
  if (!PRINTER_ROLES.has(principal.employee.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
        { status: 403 }
      ),
    };
  }
  return {
    ok: true,
    supabase,
    userId: principal.user.id,
    employeeId: principal.employee.id,
    role: principal.employee.role,
  };
}

export async function GET(request?: NextRequest) {
  const runGet = async () => {
    try {
      const auth = await authorizePrinterRequest(request);
      if (!auth.ok) return auth.response;
      const { supabase } = auth;

      const { data, error } = await supabase
        .from('card_printers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ printers: data ?? [] });
    } catch (error) {
      logger.error({ event: 'printers_list_failed', err: error }, 'Failed to list printers');
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Failed to list printers', code: 'API_ERROR' },
          printers: [],
        },
        { status: 500 }
      );
    }
  };
  return request
    ? withRateLimit(request, runGet, { customLimit: { windowMs: 60_000, maxRequests: 60 } })
    : runGet();
}

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      try {
        const auth = await authorizePrinterRequest(request);
        if (!auth.ok) return auth.response;
        const { supabase } = auth;

        const rawBody = await request.json().catch(() => null);
        const parsed = registerPrinterSchema.safeParse(rawBody);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: parsed.error.issues[0]?.message ?? 'Invalid printer registration payload',
                code: 'VALIDATION_ERROR',
              },
            },
            { status: 400 }
          );
        }

        const { cups_name, name, model, connection_type, vendor_id, product_id, device_path } =
          parsed.data;

        const { data, error } = await supabase
          .from('card_printers')
          .insert({
            cups_name,
            name,
            model,
            connection_type,
            vendor_id: vendor_id ?? null,
            product_id: product_id ?? null,
            device_path: device_path ?? null,
            status: 'offline',
            status_message: 'Registered — awaiting local print bridge or CUPS heartbeat',
            last_online_at: null,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            return NextResponse.json(
              { error: 'A printer with this CUPS name is already registered' },
              { status: 409 }
            );
          }
          throw error;
        }

        logger.info({
          event: 'printer_registered',
          actorId: auth.employeeId,
          cupsName: cups_name,
        });

        return NextResponse.json({ printer: data }, { status: 201 });
      } catch (error) {
        logger.error(
          { event: 'printer_register_failed', err: error },
          'Failed to register printer'
        );
        return NextResponse.json(
          { success: false, error: { message: 'Failed to register printer', code: 'API_ERROR' } },
          { status: 500 }
        );
      }
    },
    { customLimit: { windowMs: 60_000, maxRequests: 20 } }
  );
}
