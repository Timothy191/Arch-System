"use client";

import { AnimeStagger } from "@repo/ui/AnimeStagger";
import { GlassCard } from "@repo/ui/GlassCard";
import { Checkbox } from "@repo/ui/Checkbox";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { fetchClient } from "@repo/utils/client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type WebhookEventType =
  | "daily_log.created"
  | "daily_log.updated"
  | "breakdown.created"
  | "breakdown.updated"
  | "breakdown.completed"
  | "production_log.created"
  | "production_log.updated"
  | "operational_delay.created"
  | "operational_delay.updated";

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
  "daily_log.created",
  "daily_log.updated",
  "breakdown.created",
  "breakdown.updated",
  "breakdown.completed",
  "production_log.created",
  "production_log.updated",
  "operational_delay.created",
  "operational_delay.updated",
];

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [formData, setFormData] = useState({
    url: "",
    description: "",
    event_types: [] as WebhookEventType[],
    active: true,
  });

  const fetchWebhooks = useCallback(async () => {
    try {
      const data = await fetchClient.get<{ webhooks: WebhookEndpoint[] }>("/api/webhooks");
      setWebhooks(data.webhooks);
    } catch (_error) {
      toast.error("Failed to fetch webhooks");
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
      toast.error("URL and at least one event type are required");
      return;
    }

    try {
      await fetchClient.post("/api/webhooks", formData);
      toast.success("Webhook created successfully");
      setShowForm(false);
      setFormData({
        url: "",
        description: "",
        event_types: [],
        active: true,
      });
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create webhook");
    }
  };

  const handleUpdate = async () => {
    if (!editingWebhook) return;

    try {
      await fetchClient.put(`/api/webhooks/${editingWebhook.id}`, formData);
      toast.success("Webhook updated successfully");
      setEditingWebhook(null);
      setFormData({
        url: "",
        description: "",
        event_types: [],
        active: true,
      });
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update webhook");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      await fetchClient.delete(`/api/webhooks/${id}`);
      toast.success("Webhook deleted successfully");
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete webhook");
    }
  };

  const handleEdit = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setFormData({
      url: webhook.url,
      description: webhook.description || "",
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
        <RefreshCw className="w-8 h-8 animate-spin text-arch-accent-blue/50" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <h2 className="text-2xl font-bold tracking-tight text-arch-text-primary">
          Webhook Endpoints
        </h2>
        <Button
          onClick={() => {
            setEditingWebhook(null);
            setFormData({
              url: "",
              description: "",
              event_types: [],
              active: true,
            });
            setShowForm(!showForm);
          }}
          className="bg-arch-accent-blue text-white hover:bg-arch-accent-blue/90 shadow-sm transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </motion.div>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard
              variant="liquid"
              hover={false}
              className="p-1 mb-8"
              glassIntensity="intense"
              padding={false}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-arch-text-primary mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-arch-accent-blue animate-pulse"></span>
                  {editingWebhook ? "Edit Webhook Configuration" : "New Webhook Configuration"}
                </h3>
                <form onSubmit={editingWebhook ? handleUpdate : handleSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="url"
                      className="block text-sm font-medium text-arch-text-secondary mb-2"
                    >
                      Endpoint URL
                    </label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://api.example.com/webhooks"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="bg-white/50 border-white/20 focus-visible:ring-arch-accent-blue transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-arch-text-secondary mb-2"
                    >
                      Description (Optional)
                    </label>
                    <textarea
                      id="description"
                      placeholder="e.g., Production syncing webhook"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/50 text-arch-text-primary focus:outline-none focus:ring-2 focus:ring-arch-accent-blue/50 transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-arch-text-secondary mb-3">
                      Event Subscriptions
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {EVENT_TYPES.map((eventType) => {
                        const isSelected = formData.event_types.includes(eventType);
                        return (
                          <button
                            key={eventType}
                            type="button"
                            onClick={() => toggleEventType(eventType)}
                            className={`text-left px-4 py-3 rounded-xl border transition-all text-xs font-medium relative overflow-hidden ${
                              isSelected
                                ? "bg-arch-accent-green/10 border-arch-accent-green text-arch-accent-green"
                                : "bg-white/40 border-white/20 text-arch-text-secondary hover:bg-white/60 hover:border-white/40"
                            }`}
                          >
                            {isSelected && (
                              <motion.div
                                layoutId="active-indicator"
                                className="absolute left-0 top-0 bottom-0 w-1 bg-arch-accent-green"
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
                      className="text-sm font-medium text-arch-text-secondary"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-black/5 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/40 bg-white/30 text-arch-text-secondary hover:bg-white/60 hover:text-arch-text-primary transition-all"
                      onClick={() => {
                        setShowForm(false);
                        setEditingWebhook(null);
                        setFormData({
                          url: "",
                          description: "",
                          event_types: [],
                          active: true,
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-arch-accent-blue text-white hover:bg-arch-accent-blue/90 shadow-sm transition-transform active:scale-95"
                    >
                      {editingWebhook ? "Update Webhook" : "Create Webhook"}
                    </Button>
                  </div>
                </form>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-12 text-center rounded-2xl border border-dashed border-arch-border-subtle bg-arch-surface-primary/30"
          >
            <p className="text-arch-text-tertiary">No webhooks are currently configured</p>
          </motion.div>
        ) : (
          <AnimeStagger staggerDelay={80} distance={15} childClassName="w-full">
            {webhooks.map((webhook) => (
              <GlassCard
                key={webhook.id}
                variant="glowborder"
                hover={true}
                colorPreset="ocean"
                className="mb-4 bg-white/70 backdrop-blur-xl border border-white/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-[15px] text-arch-text-primary tracking-tight">
                        {webhook.url}
                      </h3>
                      {webhook.active ? (
                        <Badge
                          variant="default"
                          className="bg-arch-accent-green/10 text-arch-accent-green border border-arch-accent-green/20 px-2 py-0.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-black/5 border-black/10 text-arch-text-tertiary px-2 py-0.5"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {webhook.description && (
                      <p className="text-[13px] text-arch-text-secondary mb-4 font-medium leading-relaxed max-w-2xl">
                        {webhook.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {webhook.event_types.map((eventType: WebhookEventType) => (
                        <Badge
                          key={eventType}
                          variant="secondary"
                          className="text-[10px] bg-white text-arch-text-secondary border border-black/5 hover:bg-black/5 transition-colors font-semibold"
                        >
                          {eventType}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white border-black/5 text-arch-text-secondary hover:text-arch-accent-blue hover:bg-arch-accent-blue/10 transition-colors shadow-sm"
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
                      className="bg-white border-black/5 text-arch-text-tertiary hover:text-arch-accent-red hover:bg-arch-accent-red/10 transition-colors shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(webhook.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
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
