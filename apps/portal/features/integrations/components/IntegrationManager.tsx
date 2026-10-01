'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { fetchClient } from '@repo/utils/client';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  ChevronDown,
  History,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type IntegrationKind = 'mcp' | 'native' | 'action';
type InstallationStatus = 'pending' | 'active' | 'error' | 'disabled';
type AuthType = 'none' | 'api_key' | 'bearer' | 'oauth2';
type RiskClass = 'read' | 'write';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [testTool, setTestTool] = useState('');
  const [testArgs, setTestArgs] = useState('{}');
  const [testResult, setTestResult] = useState<string | null>(null);
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
              secret_kind: form.auth_type === 'api_key' ? 'api_key' : 'bearer',
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
      active: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-400' },
      error: { label: 'Error', className: 'bg-red-500/15 text-red-400' },
      disabled: { label: 'Disabled', className: 'bg-zinc-500/15 text-zinc-400' },
      pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400' },
    };
    const item = map[status];
    return <Badge className={item.className}>{item.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-[var(--text-heading)]" />
            <h2 className="text-lg font-semibold text-[var(--text-heading)]">Integrations</h2>
            <span className="text-sm text-[var(--text-muted)]">
              MCP connectors, native plugins, and actions
            </span>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Install
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleInstall}
              className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 overflow-hidden"
            >
              <label className="text-sm text-[var(--text-muted)] md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.new_entry}
                  onChange={(e) => setForm({ ...form, new_entry: e.target.checked })}
                />
                Register a new connector (not yet in catalog)
              </label>

              {form.new_entry ? (
                <>
                  <Input
                    placeholder="Name (e.g. SixtyFour Intelligence)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Server URL (streamable HTTP MCP endpoint)"
                    value={form.server_url}
                    onChange={(e) => setForm({ ...form, server_url: e.target.value })}
                  />
                  <select
                    className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm"
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
                  className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm"
                  value={form.catalog_id}
                  onChange={(e) => setForm({ ...form, catalog_id: e.target.value })}
                  required
                >
                  <option value="">Select catalog entry…</option>
                  {catalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.kind})
                    </option>
                  ))}
                </select>
              )}

              <select
                className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm"
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
                  className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm"
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
                className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm"
                value={form.risk_class}
                onChange={(e) => setForm({ ...form, risk_class: e.target.value as RiskClass })}
              >
                <option value="read">Tools are read-class (Aria executes directly)</option>
                <option value="write">Tools are write-class (confirmation required)</option>
              </select>

              <Input
                type="password"
                placeholder="API key / bearer token (encrypted at rest)"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
              />

              <Input
                className="md:col-span-2"
                placeholder="Tool allowlist (comma-separated, empty = all tools)"
                value={form.tool_allowlist}
                onChange={(e) => setForm({ ...form, tool_allowlist: e.target.value })}
              />

              <div className="md:col-span-2">
                <Button type="submit" size="sm">
                  Install integration
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </GlassCard>

      {loading ? (
        <GlassCard className="p-6 text-sm text-[var(--text-muted)]">Loading…</GlassCard>
      ) : installations.length === 0 ? (
        <GlassCard className="p-6 text-sm text-[var(--text-muted)]">
          No integrations installed yet. Install an MCP connector to expose its tools to the Aria
          assistant and dev coding agents.
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
                      <span className="font-medium text-[var(--text-heading)]">
                        {catalogEntry?.name ?? installation.catalog_id}
                      </span>
                      {statusBadge(installation.status)}
                      <Badge variant="outline" className="text-xs">
                        {installation.scope === 'global'
                          ? 'Global'
                          : departments.find((d) => d.id === installation.department_id)
                              ?.display_name || 'Department'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {installation.config.risk_class === 'write' ? 'write-class' : 'read-class'}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                      {catalogEntry?.server_url ?? '—'} · {tools.length} tool(s) synced
                      {installation.tools_synced_at
                        ? ` · ${new Date(installation.tools_synced_at).toLocaleString()}`
                        : ''}
                    </p>
                    {installation.last_error && (
                      <p className="text-xs text-red-400 mt-1 truncate">
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
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === installation.id}
                      onClick={() => toggleStatus(installation)}
                      title={installation.status === 'disabled' ? 'Enable' : 'Disable'}
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
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
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
                                    className="text-[var(--text-heading)] hover:underline"
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
                              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md px-3 py-2 text-xs font-mono"
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
                              <pre className="text-xs bg-[var(--bg-secondary)] rounded-md p-2 overflow-auto max-h-48">
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
                                        ? 'text-emerald-400'
                                        : log.status === 'denied'
                                          ? 'text-amber-400'
                                          : 'text-red-400'
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
                                    <span className="text-red-400 truncate">
                                      {log.error_message}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
