/**
 * @swagger
 * /api/integrations:
 *   get:
 *     summary: List integration catalog and installations
 *     description: >
 *       Returns the admin-curated integration catalog and the installations
 *       visible to the caller. Admins see every installation; other employees
 *       see global installations plus those scoped to their departments.
 *     tags:
 *       - Integrations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Catalog and installations
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Install an integration
 *     description: >
 *       Admin-only. Creates (or reuses) a catalog entry, stores the credential
 *       encrypted, and probes MCP servers immediately for tool discovery.
 *     tags:
 *       - Integrations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - catalog_id
 *             properties:
 *               catalog_id:
 *                 type: string
 *                 description: Slug of the catalog entry
 *               catalog_entry:
 *                 type: object
 *                 description: Inline catalog registration when the entry does not exist yet
 *               scope:
 *                 type: string
 *                 enum: [global, department]
 *               department_id:
 *                 type: string
 *                 format: uuid
 *               config:
 *                 type: object
 *                 description: Non-secret settings (risk_class, api_key_header, request_timeout_ms)
 *               secret:
 *                 type: string
 *                 description: Credential value; encrypted application-side before storage
 *               secret_kind:
 *                 type: string
 *                 enum: [api_key, bearer, custom_header]
 *               tool_allowlist:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Installation created
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */

import { installIntegrationSchema } from '@repo/contract/schemas/integration.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { validateBody } from '@/lib/api/response';
import { installIntegration, listCatalog, listInstallations } from '@/lib/integrations/service';

export async function handleGetIntegrations(): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!principal.employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  const { employee } = principal;

  const [catalog, installations] = await Promise.all([listCatalog(), listInstallations()]);
  const visible =
    employee.role === 'admin'
      ? installations
      : installations.filter(
          (installation) =>
            installation.scope === 'global' ||
            installation.department_id === employee.department_id ||
            (employee.accessible_departments ?? []).includes(installation.department_id ?? '')
        );

  return NextResponse.json({ catalog, installations: visible });
}

export async function GET(request: NextRequest) {
  const response = await withRateLimit(request, () => handleGetIntegrations());
  return applyCors(request, response);
}

async function handleInstall(request: NextRequest): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (principal.employee?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const parsed = await validateBody(request, installIntegrationSchema);
  if (parsed instanceof NextResponse) return parsed;

  const installation = await installIntegration(
    {
      catalog_id: parsed.data.catalog_id,
      catalog_entry: parsed.data.catalog_entry,
      scope: parsed.data.scope,
      department_id: parsed.data.department_id,
      config: parsed.data.config,
      secret: parsed.data.secret,
      secret_kind: parsed.data.secret_kind,
      tool_allowlist: parsed.data.tool_allowlist,
    },
    principal.user.id
  );

  return NextResponse.json({ installation }, { status: 201 });
}

export async function POST(request: NextRequest) {
  const response = await withRateLimit(request, () =>
    withBodyLimit(request, () => handleInstall(request), { maxSize: 262_144 })
  );
  return applyCors(request, response);
}
