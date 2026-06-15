"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { Trash2, Plus, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

type WebhookEventType =
  | "daily_log.created"
  | "daily_log.updated"
  | "breakdown.created"
  | "breakdown.updated"
  | "breakdown.completed"
  | "safety_incident.created"
  | "safety_incident.updated"
  | "safety_incident.resolved"
  | "production_log.created"
  | "production_log.updated"
  | "operational_delay.created"
  | "operational_delay.updated";

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  event_types: WebhookEventType[];
  department_id: string | null;
  active: boolean;
  secret: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

const EVENT_TYPES: WebhookEventType[] = [
  "daily_log.created",
  "daily_log.updated",
  "breakdown.created",
  "breakdown.updated",
  "breakdown.completed",
  "safety_incident.created",
  "safety_incident.updated",
  "safety_incident.resolved",
  "production_log.created",
  "production_log.updated",
  "operational_delay.created",
  "operational_delay.updated",
];

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(
    null,
  );
  const [formData, setFormData] = useState({
    url: "",
    description: "",
    event_types: [] as WebhookEventType[],
    active: true,
  });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch("/api/webhooks");
      const data = await response.json();
      if (response.ok) {
        setWebhooks(data.webhooks);
      }
    } catch (error) {
      toast.error("Failed to fetch webhooks");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.url || formData.event_types.length === 0) {
      toast.error("URL and at least one event type are required");
      return;
    }

    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Webhook created successfully");
        setShowForm(false);
        setFormData({
          url: "",
          description: "",
          event_types: [],
          active: true,
        });
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create webhook");
      }
    } catch (error) {
      toast.error("Failed to create webhook");
    }
  };

  const handleUpdate = async () => {
    if (!editingWebhook) return;

    try {
      const response = await fetch(`/api/webhooks/${editingWebhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Webhook updated successfully");
        setEditingWebhook(null);
        setFormData({
          url: "",
          description: "",
          event_types: [],
          active: true,
        });
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update webhook");
      }
    } catch (error) {
      toast.error("Failed to update webhook");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Webhook deleted successfully");
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete webhook");
      }
    } catch (error) {
      toast.error("Failed to delete webhook");
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
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-arch-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-arch-text-primary">
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
          className="bg-arch-accent-blue text-white hover:bg-arch-accent-blue/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 border-arch-border-primary bg-arch-surface-secondary shadow-window">
          <h3 className="text-lg font-semibold text-arch-text-primary mb-4">
            {editingWebhook ? "Edit Webhook" : "Create Webhook"}
          </h3>
          <form
            onSubmit={editingWebhook ? handleUpdate : handleSubmit}
            className="space-y-4"
          >
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
                placeholder="https://your-endpoint.com/webhook"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
                className="bg-arch-surface-primary border-arch-border-subtle focus-visible:ring-arch-accent-blue"
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
                placeholder="Describe what this webhook is for"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-arch-border-subtle rounded-lg bg-arch-surface-primary text-arch-text-primary focus:outline-none focus:border-arch-accent-blue/50 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-arch-text-secondary mb-2">
                Event Types
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {EVENT_TYPES.map((eventType) => (
                  <button
                    key={eventType}
                    type="button"
                    onClick={() => toggleEventType(eventType)}
                    className={`text-left px-3 py-2 rounded-lg border transition-all text-xs ${
                      formData.event_types.includes(eventType)
                        ? "bg-arch-accent-green/10 border-arch-accent-green text-arch-accent-green font-medium"
                        : "border-arch-border-subtle text-arch-text-secondary hover:bg-arch-surface-tertiary"
                    }`}
                  >
                    {eventType}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) =>
                  setFormData({ ...formData, active: e.target.checked })
                }
                className="w-4 h-4 rounded border-arch-border-subtle text-arch-accent-blue focus:ring-arch-accent-blue"
              />
              <label
                htmlFor="active"
                className="text-sm font-medium text-arch-text-secondary"
              >
                Active
              </label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                className="bg-arch-accent-blue text-white hover:bg-arch-accent-blue/90"
              >
                {editingWebhook ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-arch-border-subtle text-arch-text-secondary hover:bg-arch-surface-tertiary"
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
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <Card className="p-8 text-center border-arch-border-subtle bg-arch-surface-primary/30">
            <p className="text-arch-text-tertiary">
              No webhooks configured yet
            </p>
          </Card>
        ) : (
          webhooks.map((webhook) => (
            <Card
              key={webhook.id}
              className="p-6 border-arch-border-subtle bg-arch-surface-secondary shadow-card hover:shadow-diffusion-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-arch-text-primary">
                      {webhook.url}
                    </h3>
                    {webhook.active ? (
                      <Badge
                        variant="default"
                        className="bg-arch-accent-green text-white border-none"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-arch-border-subtle text-arch-text-tertiary"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {webhook.description && (
                    <p className="text-sm text-arch-text-secondary mb-3">
                      {webhook.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {webhook.event_types.map((eventType: WebhookEventType) => (
                      <Badge
                        key={eventType}
                        variant="secondary"
                        className="text-[10px] bg-arch-surface-tertiary text-arch-text-secondary border-none"
                      >
                        {eventType}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-arch-border-subtle text-arch-text-secondary hover:bg-arch-surface-tertiary"
                    onClick={() => handleEdit(webhook)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-arch-border-subtle text-arch-accent-red hover:bg-arch-accent-red/10"
                    onClick={() => handleDelete(webhook.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
