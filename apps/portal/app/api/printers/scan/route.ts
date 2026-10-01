import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { connection, NextResponse } from 'next/server';
import { detectAllPrinters } from '@/app/(departments)/access-control/lib/printer-detection';

export async function GET() {
  await connection();
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'access_control'].includes(principal.employee.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    // 1. Detect all printers via CUPS + USB
    const detected = await detectAllPrinters();

    // 2. Fetch already-registered printers from DB
    const { data: registered } = await supabase
      .from('card_printers')
      .select('cups_name, id')
      .is('deleted_at', null);

    const registeredNames = new Set((registered ?? []).map((r) => r.cups_name));

    // 3. Mark each detected printer as new or existing
    const results = detected.map((printer) => ({
      ...printer,
      isRegistered: registeredNames.has(printer.cupsName),
      dbId: registered?.find((r) => r.cups_name === printer.cupsName)?.id ?? null,
    }));

    return NextResponse.json({ printers: results, count: results.length });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Printer scan failed:', error);
    return NextResponse.json(
      { error: 'Failed to scan printers', printers: [], count: 0 },
      { status: 500 }
    );
  }
}
