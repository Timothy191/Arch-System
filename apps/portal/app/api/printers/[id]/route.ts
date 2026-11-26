import { logger } from '@repo/logger/server';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRateLimit(
    request,
    async () => {
      try {
        const { id } = await params;
        const principal = await getAuthenticatedEmployee();
        if (!principal?.employee) {
          return NextResponse.json(
            { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
            { status: 401 }
          );
        }
        if (!['admin', 'access_control'].includes(principal.employee.role)) {
          return NextResponse.json(
            { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
            { status: 403 }
          );
        }

        const supabase = await createServerSupabaseClient();
        const { error } = await supabase
          .from('card_printers')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;

        logger.info({
          event: 'printer_deleted',
          actorId: principal.employee.id,
          printerId: id,
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        logger.error({ event: 'printer_delete_failed', err: error }, 'Failed to delete printer');
        return NextResponse.json(
          { success: false, error: { message: 'Failed to delete printer', code: 'API_ERROR' } },
          { status: 500 }
        );
      }
    },
    { customLimit: { windowMs: 60_000, maxRequests: 20 } }
  );
}
