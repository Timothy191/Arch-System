import { getAuthenticatedEmployee } from '@repo/supabase';
import { NextResponse } from 'next/server';

/**
 * Emergency-muster updates are not wired to persistence yet. This route used
 * to return `{ success: true }` for any anonymous payload, which could make a
 * caller believe a person had been accounted for when nothing was written.
 *
 * It now requires an authenticated employee and reports the missing
 * implementation honestly. Wire it to the muster RPC/table before enabling it
 * in the field.
 */
export async function POST(_req: Request) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'Muster status updates are not implemented.',
        code: 'NOT_IMPLEMENTED',
      },
    },
    { status: 501 }
  );
}
