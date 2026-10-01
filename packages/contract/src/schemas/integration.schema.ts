import { z } from 'zod';
import { uuidSchema } from './common.schema';

/**
 * Integration Platform contracts (plugins / MCP connectors / actions).
 *
 * A single registry backs three plugin kinds:
 *  - `mcp`    remote streamable-HTTP MCP servers (third-party connectors)
 *  - `native` first-party in-process ArchPlugin modules
 *  - `action` authenticated HTTP action endpoints (reserved for a later phase)
 *
 * Owned here as part of the @repo/contract SSoT so the portal, the agents
 * package, and dev tooling share one vocabulary.
 */

export const integrationKindSchema = z.enum(['mcp', 'native', 'action']);
export type IntegrationKind = z.infer<typeof integrationKindSchema>;

export const integrationAuthTypeSchema = z.enum([
  'none',
  'api_key',
  'bearer',
  'custom_header',
  'oauth2',
]);
export type IntegrationAuthType = z.infer<typeof integrationAuthTypeSchema>;

export const installationStatusSchema = z.enum(['pending', 'active', 'error', 'disabled']);
export type InstallationStatus = z.infer<typeof installationStatusSchema>;

export const installationScopeSchema = z.enum(['global', 'department']);
export type InstallationScope = z.infer<typeof installationScopeSchema>;

/** Risk class driving Aria's confirmation behaviour: `write` tools require human confirmation. */
export const toolRiskClassSchema = z.enum(['read', 'write']);
export type ToolRiskClass = z.infer<typeof toolRiskClassSchema>;

const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-_.]*$/, 'Slug must be lowercase alphanumeric with - _ . separators');

/** MCP tool descriptor as returned by tools/list (subset the portal relies on). */
export const integrationToolDescriptorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
});
export type IntegrationToolDescriptor = z.infer<typeof integrationToolDescriptorSchema>;

/** Admin creates a catalog entry (curated registry) before or while installing. */
export const createCatalogEntrySchema = z.object({
  id: slugSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  author: z.string().max(120).optional(),
  icon_url: z.string().url().max(2048).optional(),
  kind: integrationKindSchema.default('mcp'),
  server_url: z.string().url().max(2048).optional(),
  auth_type: integrationAuthTypeSchema.default('none'),
  docs_url: z.string().url().max(2048).optional(),
  verified: z.boolean().optional().default(false),
});
export type CreateCatalogEntry = z.infer<typeof createCatalogEntrySchema>;

/** Install an integration: references a catalog entry and carries non-secret config. */
export const installIntegrationSchema = z
  .object({
    catalog_id: slugSchema,
    catalog_entry: createCatalogEntrySchema
      .omit({ id: true })
      .optional()
      .describe('Provided when the catalog entry does not exist yet (inline registration)'),
    scope: installationScopeSchema.default('global'),
    department_id: uuidSchema.optional(),
    /** Non-secret settings: risk class, API-key header name, timeout overrides. */
    config: z
      .object({
        risk_class: toolRiskClassSchema.optional(),
        api_key_header: z.string().min(1).max(64).optional(),
        request_timeout_ms: z.number().int().min(1000).max(120000).optional(),
      })
      .passthrough()
      .optional(),
    /** Secret payload; encrypted application-side before storage. */
    secret: z.string().min(1).max(4096).optional(),
    secret_kind: z.enum(['api_key', 'bearer', 'custom_header']).optional(),
    tool_allowlist: z.array(z.string().min(1)).max(200).optional(),
  })
  .refine((data) => !(data.scope === 'department' && !data.department_id), {
    message: 'department_id is required when scope is "department"',
    path: ['department_id'],
  })
  .refine(
    (data) =>
      data.catalog_entry?.kind !== 'mcp' || typeof data.catalog_entry.server_url === 'string',
    { message: 'server_url is required for kind "mcp"', path: ['catalog_entry', 'server_url'] }
  );
export type InstallIntegration = z.infer<typeof installIntegrationSchema>;

export const updateInstallationSchema = z.object({
  status: installationStatusSchema.optional(),
  config: z
    .object({
      risk_class: toolRiskClassSchema.optional(),
      api_key_header: z.string().min(1).max(64).optional(),
      request_timeout_ms: z.number().int().min(1000).max(120000).optional(),
    })
    .passthrough()
    .optional(),
  tool_allowlist: z.array(z.string().min(1)).max(200).optional(),
  secret: z.string().min(1).max(4096).optional(),
  secret_kind: z.enum(['api_key', 'bearer', 'custom_header']).optional(),
  server_url: z.string().url().max(2048).optional(),
});
export type UpdateInstallation = z.infer<typeof updateInstallationSchema>;

export const integrationIdParamSchema = z.object({ id: uuidSchema });

/** Admin validation call against one installed MCP tool. */
export const testIntegrationToolSchema = z.object({
  tool: z.string().min(1).max(200),
  args: z.record(z.string(), z.unknown()).optional(),
});
export type TestIntegrationTool = z.infer<typeof testIntegrationToolSchema>;

/** Machine-readable manifest consumed by dev coding agents (Claude, GLM, …). */
export const integrationManifestSchema = z.object({
  generated_at: z.string(),
  servers: z.record(
    z.string(),
    z.object({
      url: z.string().url(),
      /** Header map with ${ENV_VAR} placeholders resolved from .env.integrations */
      headers: z.record(z.string(), z.string()).optional(),
      tools: z.array(integrationToolDescriptorSchema),
    })
  ),
  env: z.record(z.string(), z.string()).describe('Env var names to values for .env.integrations'),
});
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;

/** Governance envelope for integration tool calls (PreToolUse gate). */
export const integrationToolCallSchema = z.object({
  installation_id: uuidSchema,
  tool: z.string().min(1).max(200),
  args: z.record(z.string(), z.unknown()).optional(),
});
export type IntegrationToolCall = z.infer<typeof integrationToolCallSchema>;

/**
 * Aria-facing namespaced tool name: `integration__<slug>__<tool>`.
 * Kept here so the actions route and the tool bridge agree on the format.
 */
export const INTEGRATION_TOOL_PREFIX = 'integration__';

export function parseIntegrationToolName(
  namespaced: string
): { slug: string; tool: string } | null {
  if (!namespaced.startsWith(INTEGRATION_TOOL_PREFIX)) return null;
  const rest = namespaced.slice(INTEGRATION_TOOL_PREFIX.length);
  // Split on the LAST separator so slugs containing underscores stay intact.
  const separator = rest.lastIndexOf('__');
  if (separator <= 0 || separator === rest.length - 2) return null;
  return { slug: rest.slice(0, separator), tool: rest.slice(separator + 2) };
}

export function buildIntegrationToolName(slug: string, tool: string): string {
  return `${INTEGRATION_TOOL_PREFIX}${slug}__${tool}`;
}
