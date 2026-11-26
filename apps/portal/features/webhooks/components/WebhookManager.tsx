'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { AnimeStagger } from '@repo/ui/AnimeStagger';
import { Checkbox } from '@repo/ui/Checkbox';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { fetchClient } from '@repo/utils/client';
import { AnimatePresence, m } from 'framer-motion';
import { Activity, CheckCircle, Plus, RefreshCw, Sparkles, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const MIN_HMAC_SECRET_LENGTH = 16;

type WebhookEventType =
  | 'daily_log.created'
  | 'daily_log.updated'
  | 'breakdown.created'
  | 'breakdown.updated'
  | 'breakdown.completed'
  | 'production_log.created'
  | 'production_log.updated'
  | 'operational_delay.created'
  | 'operational_delay.updated';

interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string | null;
  department_id?: string | null;
  event_types: WebhookEventType[];
  active: boolean;
  secret?: string | null;
  created_at: string;
  updated_at: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
  display_name?: string | null;
}

interface WebhookDeliveryLog {
  id: string;
  event_type: string;
  response_status: number | null;
  retry_count: number | null;
  success: boolean;
  error_message: string | null;
  delivered_at?: string | null;
  created_at: string;
}

interface WebhookDeliveryMetrics {
  total: number;
  successful: number;
  failed: number;
  retried: number;
  successRate: number;
  lastDeliveredAt: string | null;
}

const EVENT_TYPES: WebhookEventType[] = [
  'daily_log.created',
  'daily_log.updated',
  'breakdown.created',
  'breakdown.updated',
  'breakdown.completed',
  'production_log.created',
  'production_log.updated',
  'operational_delay.created',
  'operational_delay.updated',
];

const RECOMMENDED_WEBHOOKS = [
  {
    id: 'shift-closeout',
    label: 'Shift Closeout Feed',
    description: 'Daily shift logs and closeout updates',
    event_types: ['daily_log.created', 'daily_log.updated'],
  },
  {
    id: 'breakdown-alerts',
    label: 'Breakdown Alerts',
    description: 'Engineering dispatch and completion events',
    event_types: ['breakdown.created', 'breakdown.updated', 'breakdown.completed'],
  },
  {
    id: 'production-sync',
    label: 'Production Sync',
    description: 'Throughput and production log updates',
    event_types: ['production_log.created', 'production_log.updated'],
  },
  {
    id: 'delay-tracking',
    label: 'Delay Tracking',
    description: 'Operational delay and idle-time events',
    event_types: ['operational_delay.created', 'operational_delay.updated'],
  },
  {
    id: 'full-operations',
    label: 'Full Operations Feed',
    description: 'All operational events in one endpoint',
    event_types: [...EVENT_TYPES],
  },
] as const;

interface WebhookFormState {
  url: string;
  description: string;
  department_id: string;
  secret: string;
  event_types: WebhookEventType[];
  active: boolean;
}

function createEmptyForm(defaultDepartmentId = ''): WebhookFormState {
  return {
    url: '',
    description: '',
    department_id: defaultDepartmentId,
    secret: '',
    event_types: [],
    active: true,
  };
}

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<WebhookFormState>(createEmptyForm());
  const [inspectedWebhookId, setInspectedWebhookId] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<WebhookDeliveryLog[]>([]);
  const [deliveryMetrics, setDeliveryMetrics] = useState<WebhookDeliveryMetrics | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const result = await fetchClient.get<{ webhooks: WebhookEndpoint[] }>('/api/webhooks');
      setWebhooks(result.webhooks ?? []);
    } catch (_error) {
      toast.error('Failed to fetch webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from('departments')
        .select('id, name, display_name')
        .is('deleted_at', null)
        .order('display_name');
      const rows = (data as DepartmentOption[] | null) ?? [];
      setDepartments(rows);
      if (rows[0]?.id) {
        setFormData((prev) =>
          prev.department_id ? prev : { ...prev, department_id: rows[0]!.id }
        );
      }
    } catch {
      // Keep webhook list functional if departments query is unavailable
    }
  }, []);

  useEffect(() => {
    void fetchWebhooks();
    void fetchDepartments();
  }, [fetchWebhooks, fetchDepartments]);

  const loadWebhookTelemetry = useCallback(async (webhookId: string) => {
    setLoadingTelemetry(true);
    try {
      const [logsResp, metricsResp] = await Promise.all([
        fetchClient.get<{ logs: WebhookDeliveryLog[] }>(`/api/webhooks/${webhookId}/logs`),
        fetchClient.get<WebhookDeliveryMetrics>(`/api/webhooks/${webhookId}/metrics`),
      ]);
      setDeliveryLogs(logsResp.logs ?? []);
      setDeliveryMetrics(metricsResp);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load webhook telemetry');
    } finally {
      setLoadingTelemetry(false);
    }
  }, []);

  const toggleInspectWebhook = (webhookId: string) => {
    if (inspectedWebhookId === webhookId) {
      setInspectedWebhookId(null);
      return;
    }
    setInspectedWebhookId(webhookId);
    setDeliveryLogs([]);
    setDeliveryMetrics(null);
    void loadWebhookTelemetry(webhookId);
  };

  const defaultDepartmentId = departments[0]?.id ?? '';

  const handleSubmit = async () => {
    const trimmedSecret = formData.secret.trim();
    if (!formData.url || !formData.department_id || formData.event_types.length === 0) {
      toast.error('URL, department, and at least one event type are required');
      return;
    }
    if (trimmedSecret.length > 0 && trimmedSecret.length < MIN_HMAC_SECRET_LENGTH) {
      toast.error(`HMAC secret must be at least ${MIN_HMAC_SECRET_LENGTH} characters`);
      return;
    }

    try {
      await fetchClient.post('/api/webhooks', {
        url: formData.url,
        description: formData.description || undefined,
        department_id: formData.department_id,
        event_types: formData.event_types,
        active: formData.active,
        ...(trimmedSecret.length > 0 ? { secret: trimmedSecret } : {}),
      });
      toast.success('Webhook created successfully');
      setShowForm(false);
      setFormData(createEmptyForm(defaultDepartmentId));
      void fetchWebhooks();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create webhook');
    }
  };

  const handleUpdate = async () => {
    if (!editingWebhook) return;
    const trimmedSecret = formData.secret.trim();
    if (!formData.url || formData.event_types.length === 0) {
      toast.error('URL and at least one event type are required');
      return;
    }
    if (trimmedSecret.length > 0 && trimmedSecret.length < MIN_HMAC_SECRET_LENGTH) {
      toast.error(`HMAC secret must be at least ${MIN_HMAC_SECRET_LENGTH} characters`);
      return;
    }

    try {
      await fetchClient.put(`/api/webhooks/${editingWebhook.id}`, {
        url: formData.url,
        description: formData.description,
        event_types: formData.event_types,
        active: formData.active,
        ...(trimmedSecret.length > 0 ? { secret: trimmedSecret } : {}),
      });
      toast.success('Webhook updated successfully');
      setEditingWebhook(null);
      setShowForm(false);
      setFormData(createEmptyForm(defaultDepartmentId));
      void fetchWebhooks();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update webhook');
    }
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteTargetId) return;
    const idToDelete = deleteTargetId;
    try {
      await fetchClient.delete(`/api/webhooks/${idToDelete}`);
      toast.success('Webhook deleted successfully');
      setDeleteTargetId(null);
      if (inspectedWebhookId === idToDelete) {
        setInspectedWebhookId(null);
      }
      void fetchWebhooks();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete webhook');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const result = await fetchClient.post<{ retried: number; succeeded: number }>(
        `/api/webhooks/${id}/retry`
      );
      toast.success(`Retried ${result.retried} failed deliveries (${result.succeeded} succeeded)`);
      if (inspectedWebhookId === id) {
        void loadWebhookTelemetry(id);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry deliveries');
    }
  };

  const handleEdit = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setFormData({
      url: webhook.url,
      description: webhook.description || '',
      department_id: webhook.department_id || defaultDepartmentId,
      secret: '',
      event_types: webhook.event_types,
      active: webhook.active,
    });
    setShowForm(true);
  };

  const toggleEventType = (eventType: WebhookEventType) => {
    setFormData((prev) => ({
      ...prev,
      event_types: prev.event_types.includes(eventType)
        ? prev.event_types.filter((t) => t !== eventType)
        : [...prev.event_types, eventType],
    }));
  };

  const applyTemplate = (template: (typeof RECOMMENDED_WEBHOOKS)[number]) => {
    setEditingWebhook(null);
    setFormData({
      url: '',
      description: template.description,
      department_id: formData.department_id || defaultDepartmentId,
      secret: '',
      event_types: [...template.event_types] as WebhookEventType[],
      active: true,
    });
    setShowForm(true);
    toast.success(`Loaded "${template.label}" template`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-arch-accent-blue/50" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <m.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <h2 className="font-bold text-2xl text-arch-text-primary tracking-tight">
          Webhook Endpoints
        </h2>
        <Button
          onClick={() => {
            setEditingWebhook(null);
            setFormData(createEmptyForm(defaultDepartmentId));
            setShowForm(!showForm);
          }}
          className="bg-arch-accent-blue text-white shadow-sm transition-transform hover:bg-arch-accent-blue/90 active:scale-95"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </m.div>

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-arch-accent-blue" aria-hidden="true" />
          <h3 className="font-semibold text-arch-text-primary text-sm">
            Recommended Webhook Templates
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RECOMMENDED_WEBHOOKS.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template)}
              className="rounded-lg border border-white/20 bg-white/50 p-3 text-left transition-colors hover:border-arch-accent-blue hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue"
              aria-label={`Use ${template.label} template`}
            >
              <p className="font-medium text-arch-text-primary text-xs">{template.label}</p>
              <p className="mt-1 text-[11px] text-arch-text-secondary">{template.description}</p>
            </button>
          ))}
        </div>
      </GlassCard>

      <AnimatePresence mode="wait">
        {showForm && (
          <m.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard
              variant="liquid"
              hover={false}
              className="mb-8 p-1"
              glassIntensity="intense"
              padding={false}
            >
              <div className="p-6">
                <h3 className="mb-6 flex items-center gap-2 font-semibold text-arch-text-primary text-lg">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-arch-accent-blue" />
                  {editingWebhook ? 'Edit Webhook Configuration' : 'New Webhook Configuration'}
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingWebhook) {
                      void handleUpdate();
                    } else {
                      void handleSubmit();
                    }
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="url"
                        className="mb-2 block font-medium text-arch-text-secondary text-sm"
                      >
                        Endpoint URL
                      </label>
                      <Input
                        id="url"
                        type="url"
                        placeholder="https://api.example.com/webhooks"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        className="border-white/20 bg-white/50 transition-colors focus-visible:ring-arch-accent-blue"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="department_id"
                        className="mb-2 block font-medium text-arch-text-secondary text-sm"
                      >
                        Department
                      </label>
                      <select
                        id="department_id"
                        aria-label="Webhook Department"
                        value={formData.department_id}
                        disabled={Boolean(editingWebhook)}
                        onChange={(e) =>
                          setFormData({ ...formData, department_id: e.target.value })
                        }
                        required={!editingWebhook}
                        className="h-10 w-full rounded-lg border border-white/20 bg-white/50 px-3 py-2 text-arch-text-primary text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-arch-accent-blue/50 disabled:opacity-60"
                      >
                        <option value="">Select department…</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.display_name || dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="description"
                        className="mb-2 block font-medium text-arch-text-secondary text-sm"
                      >
                        Description (Optional)
                      </label>
                      <textarea
                        id="description"
                        placeholder="e.g., Production syncing webhook"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-white/20 bg-white/50 px-3 py-2 text-arch-text-primary text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-arch-accent-blue/50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="secret"
                        className="mb-2 block font-medium text-arch-text-secondary text-sm"
                      >
                        HMAC Signing Secret (Optional, min 16 chars)
                      </label>
                      <Input
                        id="secret"
                        type="password"
                        minLength={MIN_HMAC_SECRET_LENGTH}
                        placeholder={
                          editingWebhook
                            ? 'Leave blank to keep existing HMAC secret'
                            : 'Optional X-Webhook-Signature HMAC secret'
                        }
                        value={formData.secret}
                        onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                        className="border-white/20 bg-white/50 transition-colors focus-visible:ring-arch-accent-blue"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="mb-3 block font-medium text-arch-text-secondary text-sm">
                      Event Subscriptions
                    </span>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {EVENT_TYPES.map((eventType) => {
                        const isSelected = formData.event_types.includes(eventType);
                        return (
                          <button
                            key={eventType}
                            type="button"
                            onClick={() => toggleEventType(eventType)}
                            className={`relative overflow-hidden rounded-xl border px-4 py-3 text-left font-medium text-xs transition-all ${
                              isSelected
                                ? 'border-arch-accent-green bg-arch-accent-green/10 text-arch-accent-green'
                                : 'border-white/20 bg-white/40 text-arch-text-secondary hover:border-white/40 hover:bg-white/60'
                            }`}
                          >
                            {isSelected && (
                              <m.div
                                layoutId="active-indicator"
                                className="absolute top-0 bottom-0 left-0 w-1 bg-arch-accent-green"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              />
                            )}
                            {eventType}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Checkbox
                      id="active"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      label="Webhook Active Status"
                      className="font-medium text-arch-text-secondary text-sm"
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-3 border-black/5 border-t pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/40 bg-white/30 text-arch-text-secondary transition-all hover:bg-white/60 hover:text-arch-text-primary"
                      onClick={() => {
                        setShowForm(false);
                        setEditingWebhook(null);
                        setFormData(createEmptyForm(defaultDepartmentId));
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-arch-accent-blue text-white shadow-sm transition-transform hover:bg-arch-accent-blue/90 active:scale-95"
                    >
                      {editingWebhook ? 'Update Webhook' : 'Create Webhook'}
                    </Button>
                  </div>
                </form>
              </div>
            </GlassCard>
          </m.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-arch-border-subtle border-dashed bg-arch-surface-primary/30 p-12 text-center"
          >
            <p className="text-arch-text-tertiary">No webhooks are currently configured</p>
          </m.div>
        ) : (
          <AnimeStagger staggerDelay={80} distance={15} childClassName="w-full">
            {webhooks.map((webhook) => {
              const isInspected = inspectedWebhookId === webhook.id;
              const deptName = departments.find((d) => d.id === webhook.department_id);
              return (
                <GlassCard
                  key={webhook.id}
                  variant="glowborder"
                  hover={true}
                  colorPreset="ocean"
                  className="mb-4 border border-white/30 bg-white/70 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2.5">
                        <h3 className="truncate font-bold text-[15px] text-arch-text-primary tracking-tight">
                          {webhook.url}
                        </h3>
                        {webhook.active ? (
                          <Badge
                            variant="default"
                            className="border border-arch-accent-green/20 bg-arch-accent-green/10 px-2 py-0.5 text-arch-accent-green"
                          >
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-black/10 bg-black/5 px-2 py-0.5 text-arch-text-tertiary"
                          >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            Inactive
                          </Badge>
                        )}
                        {deptName && (
                          <Badge variant="outline" className="text-[11px]">
                            {deptName.display_name || deptName.name}
                          </Badge>
                        )}
                      </div>
                      {webhook.description && (
                        <p className="mb-4 max-w-2xl font-medium text-[13px] text-arch-text-secondary leading-relaxed">
                          {webhook.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {webhook.event_types.map((eventType: WebhookEventType) => (
                          <Badge
                            key={eventType}
                            variant="secondary"
                            className="border border-black/5 bg-white font-semibold text-[10px] text-arch-text-secondary transition-colors hover:bg-black/5"
                          >
                            {eventType}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-black/5 bg-white text-arch-text-secondary shadow-sm transition-colors hover:bg-arch-accent-blue/10 hover:text-arch-accent-blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleInspectWebhook(webhook.id);
                        }}
                        aria-label="Inspect delivery logs and metrics"
                      >
                        <Activity className="mr-1.5 h-4 w-4" />
                        Logs &amp; Metrics
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-black/5 bg-white text-arch-text-secondary shadow-sm transition-colors hover:bg-arch-accent-blue/10 hover:text-arch-accent-blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRetry(webhook.id);
                        }}
                        aria-label="Retry failed deliveries"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-black/5 bg-white text-arch-text-secondary shadow-sm transition-colors hover:bg-arch-accent-blue/10 hover:text-arch-accent-blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(webhook);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-black/5 bg-white text-arch-text-tertiary shadow-sm transition-colors hover:bg-arch-accent-red/10 hover:text-arch-accent-red"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(webhook.id);
                        }}
                        aria-label="Delete webhook"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isInspected && (
                    <div
                      data-testid={`webhook-telemetry-${webhook.id}`}
                      className="mt-4 space-y-3 border-black/10 border-t pt-4"
                    >
                      {loadingTelemetry ? (
                        <p className="text-arch-text-secondary text-xs">
                          Loading delivery metrics and logs…
                        </p>
                      ) : (
                        <>
                          {deliveryMetrics && (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant="outline" className="font-mono">
                                Total: {deliveryMetrics.total}
                              </Badge>
                              <Badge variant="outline" className="font-mono text-emerald-700">
                                Succeeded: {deliveryMetrics.successful}
                              </Badge>
                              <Badge variant="outline" className="font-mono text-rose-700">
                                Failed: {deliveryMetrics.failed}
                              </Badge>
                              <Badge variant="outline" className="font-mono">
                                Retried: {deliveryMetrics.retried}
                              </Badge>
                              <Badge variant="outline" className="font-mono">
                                Success Rate: {deliveryMetrics.successRate}%
                              </Badge>
                            </div>
                          )}

                          {deliveryLogs.length === 0 ? (
                            <p className="text-arch-text-tertiary text-xs">
                              No delivery attempts recorded for this endpoint yet.
                            </p>
                          ) : (
                            <div className="max-h-60 space-y-1.5 overflow-y-auto">
                              {deliveryLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/5 bg-white/80 px-3 py-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`font-semibold ${
                                        log.success ? 'text-emerald-700' : 'text-rose-700'
                                      }`}
                                    >
                                      {log.success ? 'SUCCESS' : 'FAILED'}
                                    </span>
                                    <span className="font-mono text-arch-text-primary">
                                      {log.event_type}
                                    </span>
                                    {log.response_status !== null && (
                                      <Badge variant="outline" className="font-mono text-[10px]">
                                        HTTP {log.response_status}
                                      </Badge>
                                    )}
                                    {(log.retry_count ?? 0) > 0 && (
                                      <span className="text-arch-text-secondary">
                                        retries: {log.retry_count}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-arch-text-secondary">
                                    {log.error_message && (
                                      <span className="max-w-xs truncate text-rose-700">
                                        {log.error_message}
                                      </span>
                                    )}
                                    <span className="font-mono text-[11px]">
                                      {new Date(log.created_at).toLocaleString('en-ZA')}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </AnimeStagger>
        )}
      </div>

      <Dialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? Delivery retries and future event
              triggers will stop immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDeleteWebhook()}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
