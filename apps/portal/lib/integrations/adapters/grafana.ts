import { assertSafeUrl } from '../ssrf-guard';

const DEFAULT_TIMEOUT_MS = 5_000;

export interface GrafanaHealthResult {
  isHealthy: boolean;
  version?: string;
}

export interface GrafanaDashboard {
  uid: string;
  title: string;
  url: string;
}

export interface ListApprovedDashboardsOptions {
  baseUrl: string;
  apiKey: string;
  folderUid?: string;
}

export async function checkGrafanaHealth(
  baseUrl: string,
  apiKey: string
): Promise<GrafanaHealthResult> {
  assertSafeUrl(baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) return { isHealthy: false };
    const payload = (await response.json()) as { version?: string };
    return { isHealthy: true, version: payload.version };
  } catch {
    return { isHealthy: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function listApprovedDashboards(
  options: ListApprovedDashboardsOptions
): Promise<GrafanaDashboard[]> {
  assertSafeUrl(options.baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const url = new URL(`${options.baseUrl.replace(/\/$/, '')}/api/search`);
    if (options.folderUid) url.searchParams.set('folderUid', options.folderUid);
    url.searchParams.set('type', 'dash-db');
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const dashboards = (await response.json()) as Array<{
      uid: string;
      title: string;
      url: string;
    }>;
    return dashboards.map((entry) => ({ uid: entry.uid, title: entry.title, url: entry.url }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
