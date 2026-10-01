/**
 * @swagger
 * /api/integrations/{id}/tools:
 *   post:
 *     summary: Refresh MCP tool discovery
 *     description: Admin-only. Re-runs tools/list against the connector and persists the result into the installation tool cache.
 *     tags:
 *       - Integrations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Discovered tools
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 *       409:
 *         description: Installation disabled
 *       502:
 *         description: MCP server unreachable
 */

import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { logError } from '@/lib/errors/error-logger';
import { refreshTools } from '@/lib/integrations/service';

async function handleRefresh(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (principal.employee?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const tools = await refreshTools(id);
  return NextResponse.json({ tools });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const response = await withRateLimit(request, () => handleRefresh(request, context));
    return applyCors(request, response);
  } catch (error) {
    await logError(error, { context: 'integrations_tools_route' });
    const status = error instanceof Error && error.message.includes('disabled') ? 409 : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Tool discovery failed' },
      { status }
    );
  }
}
