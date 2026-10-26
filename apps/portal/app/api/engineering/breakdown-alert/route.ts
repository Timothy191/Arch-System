import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { handleEquipmentBreakdown } from '@/workflows/equipment-maintenance';

const ALLOWED_ROLES = ['admin', 'supervisor', 'operator'];

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    if (!principal.employee || !ALLOWED_ROLES.includes(principal.employee.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }

    const { equipmentId, description } = await request.json();

    if (!equipmentId || !description) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Missing equipmentId or description', code: 'API_ERROR' },
        },
        { status: 400 }
      );
    }

    // Start the durable workflow asynchronously
    const { runId } = await start(handleEquipmentBreakdown, [equipmentId, description]);

    return NextResponse.json({
      message: 'Breakdown alert workflow started',
      equipmentId,
      runId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to start workflow', code: 'API_ERROR' } },
      { status: 500 }
    );
  }
}
