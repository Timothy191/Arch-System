'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { fetchClient } from '@repo/utils/client';
import { AnimatePresence, m } from 'framer-motion';
import {
  CheckCircle,
  ChevronDown,
  Cpu,
  ExternalLink,
  History,
  KeyRound,
  Plug,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type IntegrationKind = 'mcp' | 'native' | 'action';
type InstallationStatus = 'pending' | 'active' | 'error' | 'disabled';
type AuthType = 'none' | 'api_key' | 'bearer' | 'custom_header' | 'oauth2';
type RiskClass = 'read' | 'write';
type CatalogFilter = 'all' | IntegrationKind;

interface CatalogEntry {
  id: string;
  name: string;
  description: string | null;
  author: string | null;
  kind: IntegrationKind;
  server_url: string | null;
  auth_type: AuthType;
  verified: boolean;
  docs_url: string | null;
  capabilities?: {
    domains?: string[];
    transport?: string;
    federated_service?: string;
    [key: string]: unknown;
  } | null;
}

interface Installation {
  id: string;
  catalog_id: string;
  scope: 'global' | 'department';
  department_id: string | null;
  status: InstallationStatus;
  config: { risk_class?: RiskClass; [key: string]: unknown };
  tool_allowlist: string[];
  tool_cache: { tools?: Array<{ name: string; description?: string }> } | null;
  tools_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface AuditLog {
  id: string;
  tool_name: string;
  args_digest: string | null;
  duration_ms: number | null;
  status: 'success' | 'error' | 'denied';
  error_message: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  display_name?: string;
}

const EMPTY_FORM = {
  catalog_id: '',
  new_entry: false,
  name: '',
  server_url: '',
  auth_type: 'bearer' as AuthType,
  scope: 'global' as 'global' | 'department',
  department_id: '',
  secret: '',
  risk_class: 'read' as RiskClass,
  tool_allowlist: '',
};

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
      const next = installation.status === 'disabled' ? 'pending' : 'disabled';
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

  const statusBadge = (status: InstallationStatus) => {
    const map: Record<InstallationStatus, { label: string; className: string }> = {
      active: {
        label: 'Active',
        className: 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30',
      },
      error: {
        label: 'Error',
        className: 'bg-red-500/15 text-red-700 border border-red-500/30',
      },
      disabled: {
        label: 'Disabled',
        className: 'bg-zinc-500/15 text-zinc-700 border border-zinc-500/30',
      },
      pending: {
        label: 'Pending',
        className: 'bg-amber-500/15 text-amber-700 border border-amber-500/30',
      },
    };
    const item = map[status];
    return <Badge className={item.className}>{item.label}</Badge>;
  };

  const kindBadge = (kind: IntegrationKind) => {
    const map: Record<IntegrationKind, { label: string; className: string }> = {
      mcp: {
        label: 'MCP Server',
        className: 'bg-blue-500/12 text-blue-700 border border-blue-500/25',
      },
      action: {
        label: 'Action Bridge',
        className: 'bg-purple-500/12 text-purple-700 border border-purple-500/25',
      },
      native: {
        label: 'Native Plugin',
        className: 'bg-emerald-500/12 text-emerald-700 border border-emerald-500/25',
      },
    };
    const item = map[kind] ?? map.mcp;
    return <Badge className={`text-[11px] font-medium ${item.className}`}>{item.label}</Badge>;
  };

  const authBadge = (auth: AuthType) => {
    const labels: Record<AuthType, string> = {
      none: 'No Auth Required',
      bearer: 'Bearer Token',
      api_key: 'API Key',
      custom_header: 'Custom Header',
      oauth2: 'OAuth 2.0',
    };
    return (
      <Badge variant="outline" className="text-[11px] gap-1 text-[var(--text-secondary)]">
        <KeyRound className="w-3 h-3" />
        {labels[auth] ?? auth}
      </Badge>
    );
  };

  const selectedCatalogForForm = catalog.find((entry) => entry.id === form.catalog_id);

  return (
    <div className="space-y-6">
      {/* Header & Installation Drawer */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Plug className="w-5 h-5 text-[var(--accent-blue)]" />
              <h2 className="text-lg font-semibold text-[var(--text-heading)]">
                Integration Platform & MCP Registry
              </h2>
              <Badge variant="outline" className="text-xs font-mono">
                {catalog.length} Connectors
              </Badge>
              <Badge
                variant="outline"
                className="text-xs font-mono bg-emerald-500/10 text-emerald-700 border-emerald-500/25"
              >
                {installations.length} Installed
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Connect official Streamable-HTTP MCP servers, federated SCADA/workflow action bridges,
              and native ArchPlugins with AES-256-GCM credential encryption.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-1" />
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
              className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-[var(--border-subtle)] overflow-hidden"
            >
              <label className="text-sm text-[var(--text-secondary)] md:col-span-2 flex items-center gap-2">
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
                    className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-heading)]"
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
                  className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-heading)]"
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
                className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-heading)]"
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
                  className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-heading)]"
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
                className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-heading)]"
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

              <div className="md:col-span-2 flex items-center gap-2">
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
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Installed Connectors ({installations.length})
          </h3>
        </div>

        {loading ? (
          <GlassCard className="p-6 text-sm text-[var(--text-muted)]">
            Loading integrations…
          </GlassCard>
        ) : installations.length === 0 ? (
          <GlassCard className="p-5 text-sm text-[var(--text-secondary)] flex items-center justify-between flex-wrap gap-3">
            <span>
              No integrations installed yet. Select any connector from the{' '}
              <strong className="text-[var(--text-heading)]">Available Connector Catalog</strong>{' '}
              below to activate it for AI and department workflows.
            </span>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {installations.map((installation) => {
              const catalogEntry = catalog.find((entry) => entry.id === installation.catalog_id);
              const tools = installation.tool_cache?.tools ?? [];
              const isExpanded = expandedId === installation.id;
              return (
                <GlassCard key={installation.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--text-heading)]">
                          {catalogEntry?.name ?? installation.catalog_id}
                        </span>
                        {catalogEntry && kindBadge(catalogEntry.kind)}
                        {statusBadge(installation.status)}
                        <Badge variant="outline" className="text-xs">
                          {installation.scope === 'global'
                            ? 'Global'
                            : departments.find((d) => d.id === installation.department_id)
                                ?.display_name || 'Department'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {installation.config.risk_class === 'write'
                            ? 'write-class'
                            : 'read-class'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                        {catalogEntry?.server_url ?? 'In-process native module'} · {tools.length}{' '}
                        tool(s) synced
                        {installation.tools_synced_at
                          ? ` · ${new Date(installation.tools_synced_at).toLocaleString()}`
                          : ''}
                      </p>
                      {installation.last_error && (
                        <p className="text-xs text-red-700 mt-1 truncate">
                          {installation.last_error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => expand(installation)}
                        title="Tools & audit log"
                        aria-label="Toggle tools and audit log"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === installation.id}
                        onClick={() => refreshTools(installation)}
                        title="Refresh tool discovery"
                        aria-label="Refresh tool discovery"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === installation.id}
                        onClick={() => toggleStatus(installation)}
                        title={installation.status === 'disabled' ? 'Enable' : 'Disable'}
                        aria-label={installation.status === 'disabled' ? 'Enable' : 'Disable'}
                      >
                        {installation.status === 'disabled' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === installation.id}
                        onClick={() => remove(installation)}
                        title="Uninstall"
                        aria-label="Uninstall integration"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <m.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 mt-3 border-t border-[var(--border-default)] grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
                              Discovered tools
                            </p>
                            {tools.length === 0 ? (
                              <p className="text-xs text-[var(--text-muted)]">
                                None — run “Refresh tool discovery”.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {tools.map((tool) => (
                                  <li key={tool.name} className="text-xs">
                                    <button
                                      type="button"
                                      className="text-[var(--text-heading)] hover:underline font-mono"
                                      onClick={() => setTestTool(tool.name)}
                                    >
                                      {tool.name}
                                    </button>
                                    {tool.description && (
                                      <span className="text-[var(--text-muted)]">
                                        {' '}
                                        — {tool.description}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}

                            <p className="text-xs font-medium text-[var(--text-muted)] uppercase mt-4 mb-2">
                              Test a tool
                            </p>
                            <div className="space-y-2">
                              <Input
                                placeholder="Raw MCP tool name"
                                value={testTool}
                                onChange={(e) => setTestTool(e.target.value)}
                                className="text-xs"
                              />
                              <textarea
                                aria-label="Tool test JSON arguments"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-heading)]"
                                rows={3}
                                value={testArgs}
                                onChange={(e) => setTestArgs(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => runTest(installation)}
                                disabled={!testTool}
                              >
                                Invoke
                              </Button>
                              {testResult && (
                                <pre className="text-xs bg-[var(--bg-secondary)] rounded-md p-2 overflow-auto max-h-48 text-[var(--text-heading)]">
                                  {testResult}
                                </pre>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1">
                              <History className="w-3 h-3" /> Audit log (latest 20)
                            </p>
                            {auditLogs.length === 0 ? (
                              <p className="text-xs text-[var(--text-muted)]">No calls recorded.</p>
                            ) : (
                              <ul className="space-y-1 max-h-72 overflow-auto">
                                {auditLogs.map((log) => (
                                  <li key={log.id} className="text-xs flex items-center gap-2">
                                    <span
                                      className={
                                        log.status === 'success'
                                          ? 'text-emerald-700'
                                          : log.status === 'denied'
                                            ? 'text-amber-700'
                                            : 'text-red-700'
                                      }
                                    >
                                      ●
                                    </span>
                                    <span className="font-mono">{log.tool_name}</span>
                                    <span className="text-[var(--text-muted)]">
                                      {log.duration_ms ?? '—'}ms ·{' '}
                                      {new Date(log.created_at).toLocaleTimeString()}
                                    </span>
                                    {log.error_message && (
                                      <span className="text-red-700 truncate">
                                        {log.error_message}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Connector Marketplace Grid */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: `All Connectors (${kindCounts.all})`, icon: Sparkles },
                { id: 'mcp', label: `MCP Servers (${kindCounts.mcp})`, icon: Plug },
                { id: 'action', label: `Action Bridges (${kindCounts.action})`, icon: Workflow },
                { id: 'native', label: `Native Plugins (${kindCounts.native})`, icon: Cpu },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = catalogFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCatalogFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    active
                      ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)] shadow-2xs'
                      : 'bg-white/60 hover:bg-white/85 text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Filter by name, domain, or author…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCatalog.map((entry) => {
            const isInstalled = installedCatalogIds.has(entry.id);
            const domains = entry.capabilities?.domains ?? [];
            const isQuickInstalling = installingCatalogId === entry.id;

            return (
              <GlassCard
                key={entry.id}
                className="p-5 flex flex-col justify-between gap-4 border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-semibold text-[var(--text-heading)] truncate">
                          {entry.name}
                        </h4>
                        {entry.verified && (
                          <span
                            title="Verified Official / First-Party Connector"
                            className="inline-flex items-center text-[var(--accent-blue)]"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        by {entry.author ?? 'Arch Systems'} ·{' '}
                        <span className="font-mono">{entry.id}</span>
                      </p>
                    </div>
                    {kindBadge(entry.kind)}
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                    {entry.description}
                  </p>

                  {domains.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {domains.map((domain) => (
                        <span
                          key={domain}
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                    {authBadge(entry.auth_type)}
                    {entry.docs_url && (
                      <a
                        href={entry.docs_url}
                        target={entry.docs_url.startsWith('http') ? '_blank' : undefined}
                        rel={entry.docs_url.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="inline-flex items-center gap-1 text-[var(--accent-blue)] hover:underline font-medium"
                      >
                        Docs <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[180px]">
                      {entry.server_url ?? 'native://arch-plugin'}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isInstalled ? (
                        <>
                          <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 text-[11px]">
                            Installed
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5"
                            onClick={() => startInstallFromCatalog(entry)}
                          >
                            Add Scope
                          </Button>
                        </>
                      ) : entry.auth_type === 'none' ? (
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3"
                          disabled={isQuickInstalling}
                          onClick={() => handleQuickInstall(entry)}
                        >
                          {isQuickInstalling ? 'Installing…' : 'Quick Install'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3"
                          onClick={() => startInstallFromCatalog(entry)}
                        >
                          Configure & Install
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
