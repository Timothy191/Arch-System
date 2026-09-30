import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  try {
    const { departmentId } = await params;
    const supabase = await createServerSupabaseClient();

    // We fetch from 'fleet' table. If empty or errors, we fall back to a safe empty array
    // so the UI grid doesn't crash if the seed hasn't run.
    const { data, error } = await supabase
      .from('fleet')
      .select('id, code, category, status, hour_meter')
      .order('code');

    if (error && error.code !== '42P01') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch fleet' }, { status: 500 });
  }
}
