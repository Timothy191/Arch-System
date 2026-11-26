import { integrationIdParamSchema } from '@repo/contract/schemas/integration.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { isAppError } from '@/lib/errors/error-classes';
import { checkInstallationHealth } from '@/lib/integrations/health';

async function handleHealth(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
      { status: 401 }
    );
  }
  if (principal.employee?.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { message: 'Admin access required', code: 'API_ERROR' } },
      { status: 403 }
    );
  }
  const rawParams = await params;
  const parsedId = integrationIdParamSchema.safeParse(rawParams);
  if (!parsedId.success) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid integration ID', code: 'VALIDATION_ERROR' } },
      { status: 400 }
    );
  }
  try {
    const result = await checkInstallationHealth(parsedId.data.id);
    return NextResponse.json(result);
  } catch (err) {
    if (isAppError(err)) {
      return NextResponse.json(
        { success: false, error: { message: err.message, code: 'API_ERROR' } },
        { status: err.statusCode }
      );
    }
    throw err;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () => handleHealth(request, context));
  return applyCors(request, response);
}
