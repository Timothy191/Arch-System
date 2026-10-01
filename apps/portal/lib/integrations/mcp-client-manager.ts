import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { IntegrationAuthType } from '@repo/contract/schemas/integration.schema';
import { APIError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { decryptSecret } from './crypto';

/**
 * Server-side manager for remote streamable-HTTP MCP server connections.
 *
 * Connections are cached per installation for the lifetime of the warm serverless
 * instance; every request carries a hard timeout so a slow connector can never
 * hang a route handler. Only streamable-HTTP transport is supported — stdio
 * servers are out of scope by design (serverless runtime).
 */

const DEFAULT_TIMEOUT_MS = 20_000;
const CLIENT_INFO = { name: 'arch-portal', version: '1.5.1' } as const;

export interface ManagedInstallation {
  id: string;
  serverUrl: string;
  authType: IntegrationAuthType;
  /** Encrypted credential ciphertext from integration_credentials; null when auth_type = none. */
  credentialCiphertext: string | null;
  config: {
    api_key_header?: string;
    request_timeout_ms?: number;
    [key: string]: unknown;
  };
}

interface ManagedConnection {
  client: InstanceType<typeof Client>;
  connectedAt: number;
}

function buildHeaders(installation: ManagedInstallation): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
  };
  if (!installation.credentialCiphertext) return headers;

  const secret = decryptSecret(installation.credentialCiphertext);
  switch (installation.authType) {
    case 'bearer':
      headers.Authorization = `Bearer ${secret}`;
      break;
    case 'api_key':
      headers[installation.config.api_key_header ?? 'x-api-key'] = secret;
      break;
    case 'custom_header': {
      const headerName = installation.config.api_key_header;
      if (!headerName) {
        throw new APIError('custom_header credential requires config.api_key_header', {
          statusCode: 400,
          context: { installationId: installation.id },
        });
      }
      headers[headerName] = secret;
      break;
    }
    default:
      break;
  }
  return headers;
}

function timeoutMs(installation: ManagedInstallation): number {
  const configured = installation.config.request_timeout_ms;
  return typeof configured === 'number' && configured >= 1000 ? configured : DEFAULT_TIMEOUT_MS;
}

class McpClientManager {
  private connections = new Map<string, ManagedConnection>();

  /** Returns a live client, connecting (and caching) on first use. */
  private async getClient(installation: ManagedInstallation) {
    const existing = this.connections.get(installation.id);
    if (existing) return existing.client;

    let headers: Record<string, string>;
    try {
      headers = buildHeaders(installation);
    } catch (error) {
      // Credential decryption failures are configuration problems, not transport ones.
      logError(error, { context: 'mcp_credential_decrypt', installationId: installation.id });
      throw error;
    }

    const client = new Client(CLIENT_INFO);
    const transport = new StreamableHTTPClientTransport(new URL(installation.serverUrl), {
      requestInit: { headers },
    });

    try {
      await client.connect(transport);
    } catch (error) {
      logError(error, {
        context: 'mcp_connect_failed',
        installationId: installation.id,
        serverUrl: installation.serverUrl,
      });
      throw new APIError(
        `Failed to connect to MCP server for installation ${installation.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        {
          statusCode: 502,
          context: { installationId: installation.id },
          cause: error instanceof Error ? error : undefined,
        }
      );
    }

    const connection: ManagedConnection = { client, connectedAt: Date.now() };
    this.connections.set(installation.id, connection);
    return connection.client;
  }

  /** Lists tools with a hard timeout; never caches — callers own persistence. */
  public async listTools(installation: ManagedInstallation) {
    const client = await this.getClient(installation);
    try {
      const result = await client.listTools({}, { timeout: timeoutMs(installation) });
      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? undefined,
        inputSchema: (tool.inputSchema ?? undefined) as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      // A failed listing invalidates the cached connection — next call reconnects.
      await this.disconnect(installation.id);
      throw error;
    }
  }

  public async callTool(
    installation: ManagedInstallation,
    toolName: string,
    args: Record<string, unknown>
  ) {
    const client = await this.getClient(installation);
    try {
      return await client.callTool({ name: toolName, arguments: args }, undefined, {
        timeout: timeoutMs(installation),
      });
    } catch (error) {
      await this.disconnect(installation.id);
      throw error;
    }
  }

  public async disconnect(installationId: string): Promise<void> {
    const connection = this.connections.get(installationId);
    if (!connection) return;
    this.connections.delete(installationId);
    try {
      await connection.client.close();
    } catch (error) {
      logError(error, { context: 'mcp_close_failed', installationId });
    }
  }

  public isConnected(installationId: string): boolean {
    return this.connections.has(installationId);
  }
}

export const mcpClientManager = new McpClientManager();
