/**
 * @swagger
 * /api/integrations/{id}/test:
 *   post:
 *     summary: Invoke one tool for admin validation
 *     description: >
 *       Admin-only test path. Calls the requested MCP tool with the supplied
 *       arguments through the same guard chain Aria uses (allowlist, risk class
 *       bypassed as confirmed, audit logging).
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tool
 *             properties:
 *               tool:
 *                 type: string
 *                 description: Raw MCP tool name (not namespaced)
 *               args:
 *                 type: object
 *     responses:
 *       200:
 *         description: Tool result (ok=false reports the failure reason)
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 */

import { testIntegrationToolSchema } from '@repo/contract/schemas/integration.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { validateBody } from '@/lib/api/response';
import { getInstallation } from '@/lib/integrations/service';
import { invokeIntegrationTool } from '@/lib/integrations/tool-bridge';

async function handleTest(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (principal.employee?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const parsed = await validateBody(request, testIntegrationToolSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await params;
  const installation = await getInstallation(id);

  const result = await invokeIntegrationTool({
    tool: `integration__${installation.catalog_id}__${parsed.data.tool}`,
    installationId: id,
    args: parsed.data.args,
    employeeId: principal.user.id,
    departmentId: principal.employee.department_id ?? '',
    kind: 'write', // admin test path counts as human-confirmed
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () =>
    withBodyLimit(request, () => handleTest(request, context), { maxSize: 262_144 })
  );
  return applyCors(request, response);
}
