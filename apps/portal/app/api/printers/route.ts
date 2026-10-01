import { createBearerSupabaseClient, createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

function getClient(request?: NextRequest) {
  const authHeader = request?.headers?.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return createBearerSupabaseClient(token);
  }
  return null;
}

type PrinterAuthClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Resolve the request's Supabase client (Bearer or session-cookie auth) and
 * confirm the caller holds one of the allowed roles. Returns either the
 * authenticated client + employee row or a ready-to-return error response.
 */
async function authorizePrinterRequest(
  request: NextRequest | undefined,
  allowedRoles: readonly string[]
): Promise<
  | { ok: true; supabase: PrinterAuthClient; userId: string; role: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = getClient(request) || (await createServerSupabaseClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (!employee || !allowedRoles.includes(employee.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, supabase, userId: user.id, role: employee.role };
}

export async function GET(request?: NextRequest) {
  try {
    const auth = await authorizePrinterRequest(request, ['admin', 'access_control']);
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const details = (error as { code?: string; details?: string }).details ?? '';
    // eslint-disable-next-line no-console
    console.error('Failed to list printers:', { message, details, error });
    return NextResponse.json(
      { error: 'Failed to list printers', message, details, printers: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizePrinterRequest(request, ['admin', 'access_control']);
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const body = await request.json();
    const { cups_name, name, model, connection_type, vendor_id, product_id, device_path } = body;

    if (!cups_name || !name) {
      return NextResponse.json({ error: 'cups_name and name are required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('card_printers')
      .insert({
        cups_name,
        name,
        model: model ?? 'Neo Magic 300',
        connection_type: connection_type ?? 'usb',
        vendor_id: vendor_id ?? null,
        product_id: product_id ?? null,
        device_path: device_path ?? null,
        status: 'online',
        last_online_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A printer with this CUPS name is already registered' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ printer: data }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to register printer:', error);
    return NextResponse.json({ error: 'Failed to register printer' }, { status: 500 });
  }
}
