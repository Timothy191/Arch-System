'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { fetchClient } from '@repo/utils/client';
import { AnimatePresence, m } from 'framer-motion';
import { Plug, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type AuditLog,
  type AuthType,
  type CatalogEntry,
  type CatalogFilter,
  type Department,
  EMPTY_FORM,
  type Installation,
  IntegrationCatalogMarketplace,
  IntegrationWebhookLogsPanel,
  type RiskClass,
} from './IntegrationWebhookLogsPanel';

export function IntegrationManager() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [installingCatalogId, setInstallingCatalogId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [testTool, setTestTool] = useState('');
  const [testArgs, setTestArgs] = useState('{}');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createBrowserSupabaseClient();

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await fetchClient.get<{
        catalog: CatalogEntry[];
        installations: Installation[];
      }>('/api/integrations');
      setCatalog(data.catalog);
      setInstallations(data.installations);
    } catch {
      toast.error('Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    supabase
      .from('departments')
      .select('id, name, display_name')
      .order('display_name')
      .then(({ data }) => setDepartments((data as Department[]) ?? []));
  }, [fetchIntegrations, supabase]);

  const installedCatalogIds = useMemo(
    () => new Set(installations.map((inst) => inst.catalog_id)),
    [installations]
  );

  const kindCounts = useMemo(() => {
    return {
      all: catalog.length,
      mcp: catalog.filter((c) => c.kind === 'mcp').length,
      action: catalog.filter((c) => c.kind === 'action').length,
      native: catalog.filter((c) => c.kind === 'native').length,
    };
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter((entry) => {
      if (catalogFilter !== 'all' && entry.kind !== catalogFilter) return false;
      if (!q) return true;
      const domains = entry.capabilities?.domains ?? [];
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q) ||
        (entry.description ?? '').toLowerCase().includes(q) ||
        (entry.author ?? '').toLowerCase().includes(q) ||
        domains.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [catalog, catalogFilter, searchQuery]);

  const startInstallFromCatalog = (entry: CatalogEntry) => {
    setForm({
      ...EMPTY_FORM,
      catalog_id: entry.id,
      new_entry: false,
      auth_type: entry.auth_type,
      risk_class: entry.kind === 'action' ? 'write' : 'read',
    });
    setShowForm(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleQuickInstall = async (entry: CatalogEntry) => {
    setInstallingCatalogId(entry.id);
    try {
      await fetchClient.post('/api/integrations', {
        catalog_id: entry.id,
        scope: 'global',
        config: { risk_class: entry.kind === 'action' ? 'write' : 'read' },
      });
      toast.success(`${entry.name} installed`);
      fetchIntegrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Quick install failed');
    } finally {
      setInstallingCatalogId(null);
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    const catalogId = form.new_entry
      ? form.catalog_id || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : form.catalog_id;
    if (!catalogId) {
      toast.error('Catalog entry is required');
      return;
    }
    if (form.new_entry && form.auth_type !== 'none' && !form.server_url) {
      toast.error('MCP servers require a server URL');
      return;
    }
    const selectedCatalog = catalog.find((item) => item.id === catalogId);
    const effectiveAuthType = form.new_entry
      ? form.auth_type
      : (selectedCatalog?.auth_type ?? form.auth_type);

    try {
      await fetchClient.post('/api/integrations', {
        catalog_id: catalogId,
        ...(form.new_entry
          ? {
              catalog_entry: {
                name: form.name || catalogId,
                kind: 'mcp',
                server_url: form.server_url || undefined,
                auth_type: form.auth_type,
                verified: false,
              },
            }
          : {}),
        scope: form.scope,
        ...(form.scope === 'department' && form.department_id
          ? { department_id: form.department_id }
          : {}),
        config: { risk_class: form.risk_class },
        ...(form.secret
          ? {
              secret: form.secret,
              secret_kind: effectiveAuthType === 'api_key' ? 'api_key' : 'bearer',
            }
          : {}),
        ...(form.tool_allowlist.trim()
          ? {
              tool_allowlist: form.tool_allowlist
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            }
          : {}),
      });
      toast.success('Integration installed');
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchIntegrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Install failed');
    }
  };

  const toggleStatus = async (installation: Installation) => {
    setBusyId(installation.id);
    try {
      const next =
        installation.status === 'disabled'
          ? installation.tools_synced_at
            ? 'active'
            : 'pending'
          : 'disabled';
      await fetchClient.patch(`/api/integrations/${installation.id}`, { status: next });
      fetchIntegrations();
    } catch {
      toast.error('Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  const refreshTools = async (installation: Installation) => {
    setBusyId(installation.id);
    try {
      const data = await fetchClient.post<{ tools: Array<{ name: string }> }>(
        `/api/integrations/${installation.id}/tools`
      );
      toast.success(`Discovered ${data.tools.length} tool(s)`);
      fetchIntegrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Discovery failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (installation: Installation) => {
    setBusyId(installation.id);
    try {
      await fetchClient.delete(`/api/integrations/${installation.id}`);
      toast.success('Integration removed');
      fetchIntegrations();
    } catch {
      toast.error('Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const expand = async (installation: Installation) => {
    if (expandedId === installation.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(installation.id);
    setTestTool('');
    setTestArgs('{}');
    setTestResult(null);
    try {
      const data = await fetchClient.get<{ auditLogs: AuditLog[] }>(
        `/api/integrations/${installation.id}`
      );
      setAuditLogs(data.auditLogs);
    } catch {
      setAuditLogs([]);
    }
  };

  const runTest = async (installation: Installation) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(testArgs) as Record<string, unknown>;
    } catch {
      toast.error('Test arguments must be valid JSON');
      return;
    }
    setTestResult('Running…');
    try {
      const data = await fetchClient.post<{ ok: boolean; data?: unknown; error?: string }>(
        `/api/integrations/${installation.id}/test`,
        { tool: testTool, args }
      );
      setTestResult(data.ok ? JSON.stringify(data.data, null, 2) : `Error: ${data.error}`);
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : 'Test call failed');
    }
  };

  const selectedCatalogForForm = catalog.find((entry) => entry.id === form.catalog_id);

  return (
    <div className="space-y-6">
      {/* Header & Installation Drawer */}
      <GlassCard className="p-6">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <Plug className="h-5 w-5 text-[var(--accent-blue)]" />
              <h2 className="font-semibold text-[var(--text-heading)] text-lg">
                Integration Platform & MCP Registry
              </h2>
              <Badge variant="outline" className="font-mono text-xs">
                {catalog.length} Connectors
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/25 bg-emerald-500/10 font-mono text-emerald-700 text-xs"
              >
                {installations.length} Installed
              </Badge>
            </div>
            <p className="mt-1 text-[var(--text-muted)] text-xs">
              Connect official Streamable-HTTP MCP servers, federated SCADA/workflow action bridges,
              and native ArchPlugins with AES-256-GCM credential encryption.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} size="sm" className="shrink-0">
            <Plus className="mr-1 h-4 w-4" />
            {showForm ? 'Close Installer' : 'Custom / Install'}
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <m.form
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onSubmit={handleInstall}
              className="grid grid-cols-1 gap-3 overflow-hidden border-[var(--border-subtle)] border-t pt-4 md:grid-cols-2"
            >
              <label className="flex items-center gap-2 text-[var(--text-secondary)] text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.new_entry}
                  onChange={(e) => setForm({ ...form, new_entry: e.target.checked })}
                />
                Register a custom MCP connector (not yet in curated catalog)
              </label>

              {form.new_entry ? (
                <>
                  <Input
                    placeholder="Name (e.g. Custom Fleet MCP)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Server URL (Streamable-HTTP MCP endpoint)"
                    value={form.server_url}
                    onChange={(e) => setForm({ ...form, server_url: e.target.value })}
                  />
                  <select
                    aria-label="Authentication type"
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                    value={form.auth_type}
                    onChange={(e) => setForm({ ...form, auth_type: e.target.value as AuthType })}
                  >
                    <option value="none">No auth</option>
                    <option value="bearer">Bearer token</option>
                    <option value="api_key">API key header</option>
                  </select>
                </>
              ) : (
                <select
                  aria-label="Select catalog entry"
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                  value={form.catalog_id}
                  onChange={(e) => {
                    const nextEntry = catalog.find((c) => c.id === e.target.value);
                    setForm({
                      ...form,
                      catalog_id: e.target.value,
                      auth_type: nextEntry?.auth_type ?? 'bearer',
                    });
                  }}
                  required
                >
                  <option value="">Select catalog entry…</option>
                  {catalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.kind.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Installation scope"
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                value={form.scope}
                onChange={(e) =>
                  setForm({ ...form, scope: e.target.value as 'global' | 'department' })
                }
              >
                <option value="global">Global (all departments)</option>
                <option value="department">Department-scoped</option>
              </select>

              {form.scope === 'department' && (
                <select
                  aria-label="Target department"
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  required
                >
                  <option value="">Select department…</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.display_name || dept.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Tool execution risk class"
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                value={form.risk_class}
                onChange={(e) => setForm({ ...form, risk_class: e.target.value as RiskClass })}
              >
                <option value="read">Tools are read-class (Agents execute directly)</option>
                <option value="write">Tools are write-class (confirmation required)</option>
              </select>

              {(form.new_entry
                ? form.auth_type !== 'none'
                : selectedCatalogForForm?.auth_type !== 'none') && (
                <Input
                  type="password"
                  placeholder="API key / Bearer token (AES-256-GCM encrypted at rest)"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                />
              )}

              <Input
                className="md:col-span-2"
                placeholder="Tool allowlist (comma-separated, empty = all discovered tools)"
                value={form.tool_allowlist}
                onChange={(e) => setForm({ ...form, tool_allowlist: e.target.value })}
              />

              <div className="flex items-center gap-2 md:col-span-2">
                <Button type="submit" size="sm">
                  Install Integration
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowForm(false);
                    setForm(EMPTY_FORM);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </m.form>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Active Installations Section */}
      <IntegrationWebhookLogsPanel
        loading={loading}
        catalog={catalog}
        installations={installations}
        departments={departments}
        busyId={busyId}
        expandedId={expandedId}
        auditLogs={auditLogs}
        testTool={testTool}
        setTestTool={setTestTool}
        testArgs={testArgs}
        setTestArgs={setTestArgs}
        testResult={testResult}
        onExpand={expand}
        onRefreshTools={refreshTools}
        onToggleStatus={toggleStatus}
        onRemove={remove}
        onRunTest={runTest}
      />

      {/* Available Connector Marketplace Grid */}
      <IntegrationCatalogMarketplace
        kindCounts={kindCounts}
        catalogFilter={catalogFilter}
        setCatalogFilter={setCatalogFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredCatalog={filteredCatalog}
        installedCatalogIds={installedCatalogIds}
        installingCatalogId={installingCatalogId}
        onStartInstallFromCatalog={startInstallFromCatalog}
        onQuickInstall={handleQuickInstall}
      />
    </div>
  );
}
