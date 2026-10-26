import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { checkInstallationHealth } from '@/lib/integrations/health';

async function handleHealth(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getAuthenticatedEmployee();
  if (principal?.employee?.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { message: 'Admin access required', code: 'API_ERROR' } },
      { status: 403 }
    );
  }
  const { id } = await params;
  const result = await checkInstallationHealth(id);
  return NextResponse.json(result);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () => handleHealth(request, context));
  return applyCors(request, response);
}
