import { mcpClientManager } from './mcp-client-manager';
import { getInstallation, toManagedInstallation, updateInstallation } from './service';

const HEALTH_TIMEOUT_MS = 5_000;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export type HealthStatus = 'healthy' | 'unhealthy' | 'stale';

export interface HealthResult {
  status: HealthStatus;
  latencyMs: number;
  error?: string;
  checkedAt: string;
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
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        mcpClientManager.listTools(managed),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Health check timed out')), HEALTH_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
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
