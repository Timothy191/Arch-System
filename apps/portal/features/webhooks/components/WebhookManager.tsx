'use client';

import { AnimeStagger } from '@repo/ui/AnimeStagger';
import { Checkbox } from '@repo/ui/Checkbox';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { fetchClient } from '@repo/utils/client';
import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

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
  description?: string;
  event_types: WebhookEventType[];
  active: boolean;
  secret?: string;
  created_at: string;
  updated_at: string;
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

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [formData, setFormData] = useState({
    url: '',
    description: '',
    event_types: [] as WebhookEventType[],
    active: true,
  });

  const fetchWebhooks = useCallback(async () => {
    try {
      const data = await fetchClient.get<{ webhooks: WebhookEndpoint[] }>('/api/webhooks');
      setWebhooks(data.webhooks);
    } catch (_error) {
      toast.error('Failed to fetch webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.url || formData.event_types.length === 0) {
      toast.error('URL and at least one event type are required');
      return;
    }

    try {
      await fetchClient.post('/api/webhooks', formData);
      toast.success('Webhook created successfully');
      setShowForm(false);
      setFormData({
        url: '',
        description: '',
        event_types: [],
        active: true,
      });
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create webhook');
    }
  };

  const handleUpdate = async () => {
    if (!editingWebhook) return;

    try {
      await fetchClient.put(`/api/webhooks/${editingWebhook.id}`, formData);
      toast.success('Webhook updated successfully');
      setEditingWebhook(null);
      setFormData({
        url: '',
        description: '',
        event_types: [],
        active: true,
      });
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update webhook');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await fetchClient.delete(`/api/webhooks/${id}`);
      toast.success('Webhook deleted successfully');
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete webhook');
    }
  };

  const handleEdit = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setFormData({
      url: webhook.url,
      description: webhook.description || '',
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
            setFormData({
              url: '',
              description: '',
              event_types: [],
              active: true,
            });
            setShowForm(!showForm);
          }}
          className="bg-arch-accent-blue text-white shadow-sm transition-transform hover:bg-arch-accent-blue/90 active:scale-95"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </m.div>

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
                  <span className="h-2 w-2 animate-pulse rounded-full bg-arch-accent-blue"></span>
                  {editingWebhook ? 'Edit Webhook Configuration' : 'New Webhook Configuration'}
                </h3>
                <form onSubmit={editingWebhook ? handleUpdate : handleSubmit} className="space-y-6">
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
                    <label className="mb-3 block font-medium text-arch-text-secondary text-sm">
                      Event Subscriptions
                    </label>
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
                        setFormData({
                          url: '',
                          description: '',
                          event_types: [],
                          active: true,
                        });
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
            {webhooks.map((webhook) => (
              <GlassCard
                key={webhook.id}
                variant="glowborder"
                hover={true}
                colorPreset="ocean"
                className="mb-4 border border-white/30 bg-white/70 backdrop-blur-xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="font-bold text-[15px] text-arch-text-primary tracking-tight">
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
                  <div className="ml-6 flex items-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
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
                        handleDelete(webhook.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </AnimeStagger>
        )}
      </div>
    </div>
  );
}
