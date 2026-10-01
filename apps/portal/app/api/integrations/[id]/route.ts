/**
 * @swagger
 * /api/integrations/{id}:
 *   get:
 *     summary: Get installation detail with audit log tail
 *     description: Admins see any installation; other employees only installations scoped to their departments (or global ones).
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
 *         description: Installation detail with recent audit logs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update an installation
 *     description: Admin-only. Toggle status, edit config/allowlist, rotate the secret, or point the catalog entry at a new server URL.
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
 *         description: Updated installation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Uninstall an integration
 *     description: Admin-only. Cascades credentials; keeps audit logs.
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
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 *       404:
 *         description: Not found
 */

import { updateInstallationSchema } from '@repo/contract/schemas/integration.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { validateBody } from '@/lib/api/response';
import { logError } from '@/lib/errors/error-logger';
import {
  deleteInstallation,
  getInstallation,
  listAuditLogs,
  updateInstallation,
} from '@/lib/integrations/service';

function canView(
  employee: { role: string; department_id: string | null; accessible_departments: string[] | null },
  installation: { scope: string; department_id: string | null }
): boolean {
  if (employee.role === 'admin') return true;
  if (installation.scope === 'global') return true;
  return (
    installation.department_id === employee.department_id ||
    (employee.accessible_departments ?? []).includes(installation.department_id ?? '')
  );
}

async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!principal.employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const { id } = await params;
  const installation = await getInstallation(id);
  if (!canView(principal.employee, installation)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const auditLogs = principal.employee.role === 'admin' ? await listAuditLogs(id) : [];
  return NextResponse.json({ installation, auditLogs });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () => handleGet(request, context));
  return applyCors(request, response);
}

async function handlePatch(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (principal.employee?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const parsed = await validateBody(request, updateInstallationSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await params;
  const installation = await updateInstallation(id, parsed.data);
  return NextResponse.json({ installation });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () => handlePatch(request, context));
  return applyCors(request, response);
}

async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (principal.employee?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  await getInstallation(id); // 404 when missing
  await deleteInstallation(id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const response = await withRateLimit(request, () => handleDelete(request, context));
    return applyCors(request, response);
  } catch (error) {
    await logError(error, { context: 'integrations_delete_route' });
    return NextResponse.json({ error: 'Failed to delete installation' }, { status: 500 });
  }
}
