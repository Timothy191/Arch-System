import { checkGrafanaHealth } from './adapters/grafana';
import { checkPrometheusHealth } from './adapters/prometheus';
import { decryptSecret } from './crypto';
import {
  buildIntegrationAuthHeaders,
  type ManagedInstallation,
  mcpClientManager,
} from './mcp-client-manager';
import { getInstallation, toManagedInstallation, updateInstallation } from './service';
import { assertSafeUrl } from './ssrf-guard';

const HEALTH_TIMEOUT_MS = 5_000;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const HTTP_SERVER_ERROR_STATUS = 500;
const HTTP_METHOD_NOT_ALLOWED_STATUS = 405;

export type HealthStatus = 'healthy' | 'unhealthy' | 'stale';

export interface HealthResult {
  status: HealthStatus;
  latencyMs: number;
  error?: string;
  checkedAt: string;
}

async function probeActionConnectorHealth(
  catalogId: string,
  managed: ManagedInstallation
): Promise<void> {
  assertSafeUrl(managed.serverUrl);
  const adapter = managed.capabilities?.adapter;

  if (adapter === 'grafana' || catalogId === 'grafana') {
    const apiKey = managed.credentialCiphertext ? decryptSecret(managed.credentialCiphertext) : '';
    const grafanaHealth = await checkGrafanaHealth(managed.serverUrl, apiKey);
    if (!grafanaHealth.isHealthy) {
      throw new Error('Grafana health endpoint reported unhealthy');
    }
    return;
  }

  if (adapter === 'prometheus' || catalogId === 'prometheus') {
    const isHealthy = await checkPrometheusHealth(managed.serverUrl);
    if (!isHealthy) {
      throw new Error('Prometheus health endpoint reported unhealthy');
    }
    return;
  }

  const headers = buildIntegrationAuthHeaders(managed);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    let response = await fetch(managed.serverUrl, {
      method: 'HEAD',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    });
    if (response.status === HTTP_METHOD_NOT_ALLOWED_STATUS) {
      response = await fetch(managed.serverUrl, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
    }
    if (response.status >= HTTP_SERVER_ERROR_STATUS) {
      throw new Error(`Action endpoint returned HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function checkInstallationHealth(installationId: string): Promise<HealthResult> {
  const checkedAt = new Date().toISOString();
  const start = Date.now();
  try {
    const installation = await getInstallation(installationId);
    if (installation.status === 'disabled') {
      return { status: 'unhealthy', latencyMs: 0, error: 'Installation is disabled', checkedAt };
    }
    const managed = await toManagedInstallation(installation);

    if (managed.kind === 'action') {
      await probeActionConnectorHealth(installation.catalog_id, managed);
    } else {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          mcpClientManager.listTools(managed),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Health check timed out')),
              HEALTH_TIMEOUT_MS
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    const latencyMs = Date.now() - start;
    const syncedAt = installation.tools_synced_at
      ? new Date(installation.tools_synced_at).getTime()
      : 0;
    const isStale = syncedAt > 0 && Date.now() - syncedAt > STALE_THRESHOLD_MS;
    if (isStale) {
      await updateInstallation(installationId, { status: 'active' });
      return { status: 'stale', latencyMs, checkedAt };
    }
    await updateInstallation(installationId, { status: 'active', last_error: null });
    return { status: 'healthy', latencyMs, checkedAt };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Health check failed';
    try {
      await updateInstallation(installationId, { status: 'error', last_error: message });
    } catch {
      // best-effort
    }
    return { status: 'unhealthy', latencyMs, error: message, checkedAt };
  }
}
