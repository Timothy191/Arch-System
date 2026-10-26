/**
 * @swagger
 * /api/integrations/manifest:
 *   get:
 *     summary: Dev-agent MCP manifest
 *     description: >
 *       Machine-readable manifest of active MCP integrations for coding agents
 *       (Claude, GLM, …). Consumed by scripts/sync-integrations-mcp.* to write
 *       .mcp.json-style configs. Requires an admin session OR the
 *       INTEGRATIONS_MANIFEST_TOKEN bearer token.
 *     tags:
 *       - Integrations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Manifest with server URLs, header placeholders, and env values
 *       401:
 *         description: Unauthorized
 */

import { timingSafeEqual } from 'node:crypto';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { listActiveMcpIntegrations } from '@/lib/integrations/service';

function envVarName(slug: string): string {
  return `ARCH_INTEGRATION_${slug.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

function headerFor(
  authType: string,
  secretEnvRef: string,
  config: Record<string, unknown>
): Record<string, string> | undefined {
  switch (authType) {
    case 'bearer':
      return { Authorization: `Bearer \${${secretEnvRef}}` };
    case 'api_key':
      return {
        [typeof config.api_key_header === 'string' ? config.api_key_header : 'x-api-key']:
          `\${${secretEnvRef}}`,
      };
    case 'custom_header':
      return typeof config.api_key_header === 'string'
        ? { [config.api_key_header]: `\${${secretEnvRef}}` }
        : undefined;
    default:
      return undefined;
  }
}

async function handleManifest(): Promise<NextResponse> {
  const active = await listActiveMcpIntegrations();

  const servers: Record<string, unknown> = {};
  const envRefs: string[] = [];

  for (const { managed, installation, catalog, slug } of active) {
    if (!catalog.server_url) continue;

    const envRef = envVarName(slug);
    let headers: Record<string, string> | undefined;
    if (managed.credentialCiphertext) {
      // Never emit plaintext secrets. Emit only the env-var reference name;
      // the secret must be supplied out-of-band via the gitignored
      // .env.integrations file. Downstream sync script resolves ${ENV_VAR}.
      envRefs.push(envRef);
      headers = headerFor(catalog.auth_type, envRef, installation.config);
    }

    servers[slug] = {
      url: catalog.server_url,
      headers,
      tools: installation.tool_cache?.tools ?? [],
    };
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    servers,
    env_refs: envRefs,
  });
}

export async function GET(request: NextRequest) {
  const response = await withRateLimit(request, async () => {
    const manifestToken = process.env.INTEGRATIONS_MANIFEST_TOKEN;
    const authHeader = request.headers.get('authorization') ?? '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    let isTokenValid = false;
    if (manifestToken && bearer) {
      const a = Buffer.from(manifestToken);
      const b = Buffer.from(bearer);
      if (a.length === b.length) {
        isTokenValid = timingSafeEqual(a, b);
      }
    }

    if (!isTokenValid) {
      const principal = await getAuthenticatedEmployee();
      if (principal?.employee?.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
          { status: 401 }
        );
      }
    }

    return handleManifest();
  });
  return applyCors(request, response);
}
