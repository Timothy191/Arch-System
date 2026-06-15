"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { GlassCard } from "@repo/ui/GlassCard";
import { Edit2, Plus, Power } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { logError } from "@/lib/errors/error-logger";
import { adminAddSite, adminUpdateSite } from "../actions/sites";

interface Site {
  id: string;
  name: string;
  site_code: string;
  active: boolean;
  created_at: string;
  machineCount?: number;
}

export function SitesTab() {
  const supabase = createBrowserSupabaseClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const loadSites = useCallback(async () => {
    setLoading(true);
    const [{ data: siteData }, { data: machineCounts }] = await Promise.all([
      supabase
        .from("sites")
        .select("id, name, site_code, active, created_at")
        .order("name"),
      supabase.from("machines").select("site_id").not("site_id", "is", null),
    ]);
    if (siteData) {
      const countMap = new Map<string, number>();
      (machineCounts ?? []).forEach((m) => {
        if (m.site_id)
          countMap.set(m.site_id, (countMap.get(m.site_id) ?? 0) + 1);
      });
      setSites(
        siteData.map((s) => ({ ...s, machineCount: countMap.get(s.id) ?? 0 })),
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const handleAdd = () => {
    setEditingSite(null);
    setDialogError("");
    setShowDialog(true);
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setDialogError("");
    setShowDialog(true);
  };

  const [pendingToggle, setPendingToggle] = useState<Site | null>(null);

  const handleConfirmToggle = async () => {
    if (!pendingToggle) return;
    setSaving(true);
    const result = await adminUpdateSite(pendingToggle.id, {
      active: !pendingToggle.active,
    });
    if (result.error) {
      logError(new Error(result.error), { context: "sites_toggle_active" });
    }
    setPendingToggle(null);
    setSaving(false);
    await loadSites();
  };

  const handleSave = async (data: {
    name: string;
    site_code: string;
    active: boolean;
  }) => {
    setSaving(true);
    setDialogError("");

    const result = editingSite
      ? await adminUpdateSite(editingSite.id, data)
      : await adminAddSite(data);

    if (result.error) {
      setDialogError(result.error);
    } else {
      setShowDialog(false);
      await loadSites();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--text-heading)]">
          Sites
        </h2>
        <Button
          onClick={handleAdd}
          className="bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </Button>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                {[
                  "Name",
                  "Site Code",
                  "Machines",
                  "Status",
                  "Created",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider${h === "Actions" ? " text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-[var(--text-muted)]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : sites.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-[var(--text-muted)]"
                  >
                    No sites configured. Add one to get started.
                  </td>
                </tr>
              ) : (
                sites.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <td className="px-6 py-4 text-[var(--text-heading)] text-sm font-medium">
                      {s.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded font-mono text-xs bg-[var(--bg-secondary)] text-[var(--accent-cyan)] border border-[var(--border-default)]">
                        {s.site_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {(s.machineCount ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
                          {s.machineCount}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={
                          s.active
                            ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                            : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-default)]"
                        }
                      >
                        {s.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                      {new Date(s.created_at).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(s)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          className={
                            s.active
                              ? "text-accent-red hover:text-accent-red/80"
                              : "text-accent-green hover:text-accent-green/80"
                          }
                          onClick={() => setPendingToggle(s)}
                          title={s.active ? "Deactivate" : "Activate"}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Confirm deactivate / activate dialog */}
      <Dialog
        open={!!pendingToggle}
        onOpenChange={(open) => !open && setPendingToggle(null)}
      >
        <DialogContent className="bg-[var(--bg-primary)] border-[var(--border-default)] max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingToggle?.active ? "Deactivate Site?" : "Activate Site?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-body)] text-sm">
            {pendingToggle?.active
              ? `"${pendingToggle?.name}" will be marked inactive.${
                  (pendingToggle?.machineCount ?? 0) > 0
                    ? ` ${pendingToggle?.machineCount} machine(s) are currently assigned to this site.`
                    : ""
                }`
              : `"${pendingToggle?.name}" will become active and available for machine assignments.`}
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setPendingToggle(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              disabled={saving}
              className={
                pendingToggle?.active
                  ? "bg-accent-red hover:bg-accent-red/90 text-white"
                  : "bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
              }
              onClick={handleConfirmToggle}
            >
              {saving
                ? "Saving…"
                : pendingToggle?.active
                  ? "Deactivate"
                  : "Activate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[var(--bg-primary)] border-[var(--border-default)] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit Site" : "Add Site"}</DialogTitle>
          </DialogHeader>
          <SiteForm
            site={editingSite}
            error={dialogError}
            saving={saving}
            onSubmit={handleSave}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SiteForm({
  site,
  error,
  saving,
  onSubmit,
  onCancel,
}: {
  site: Site | null;
  error: string;
  saving: boolean;
  onSubmit: (_data: {
    name: string;
    site_code: string;
    active: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(site?.name || "");
  const [siteCode, setSiteCode] = useState(site?.site_code || "");
  const [active, setActive] = useState(site?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, site_code: siteCode, active });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Name <span className="text-accent-red">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. North Pit"
          className="bg-[var(--bg-secondary)] border-[var(--border-default)]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Site Code <span className="text-accent-red">*</span>
        </label>
        <Input
          value={siteCode}
          onChange={(e) =>
            setSiteCode(e.target.value.toUpperCase().replace(/\s+/g, "-"))
          }
          placeholder="e.g. NP-01"
          className="bg-[var(--bg-secondary)] border-[var(--border-default)] font-mono"
          required
        />
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Unique short code. Auto-uppercased.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="site-active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4 accent-[var(--accent-emerald)]"
        />
        <label
          htmlFor="site-active"
          className="text-sm font-medium text-[var(--text-body)]"
        >
          Active
        </label>
      </div>

      {error && (
        <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
        >
          {saving ? "Saving…" : site ? "Update" : "Add Site"}
        </Button>
      </div>
    </form>
  );
}
