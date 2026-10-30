import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  try {
    const { departmentId } = await params;
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    if (!principal.employee) {
      return NextResponse.json(
        { success: false, error: { message: 'Employee record not found', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }

    const { employee } = principal;
    const hasDepartmentAccess =
      employee.role === 'admin' ||
      employee.department_id === departmentId ||
      (employee.accessible_departments ?? []).includes(departmentId);

    if (!hasDepartmentAccess) {
      return NextResponse.json(
        { success: false, error: { message: 'Department access denied', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }

    // We fetch from 'fleet' table. If empty or errors, we fall back to a safe empty array
    // so the UI grid doesn't crash if the seed hasn't run.
    const { data, error } = await supabase
      .from('fleet')
      .select('id, fleet_code, vehicle_type, registration_number, make, model, status')
      .order('fleet_code');

    if (error && error.code !== '42P01') {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'API_ERROR' } },
        { status: 500 }
      );
    }

    const mapped = (data || []).map((row) => ({
      ...row,
      code: row.fleet_code,
      category: row.vehicle_type,
      hour_meter: 0,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch fleet', code: 'API_ERROR' } },
      { status: 500 }
    );
  }
}
