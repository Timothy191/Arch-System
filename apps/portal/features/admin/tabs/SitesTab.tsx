'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
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
import { CheckCircle2, Edit2, Layers, MapPin, Plus, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  adminAddMineBlock,
  adminAddSite,
  adminDeleteMineBlock,
  adminDeleteSite,
  adminUpdateMineBlock,
  adminUpdateSite,
} from '../actions/sites';

interface DbSiteRow {
  id: string;
  name: string;
  site_code: string;
  active: boolean;
}

interface DbMineBlockRow {
  id: string;
  name: string;
  code: string;
  site_id: string | null;
  active: boolean;
}

type PendingSiteDelete =
  | { kind: 'site'; row: DbSiteRow }
  | { kind: 'block'; row: DbMineBlockRow }
  | null;

export function SitesTab() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [dbSites, setDbSites] = useState<DbSiteRow[]>([]);
  const [dbBlocks, setDbBlocks] = useState<DbMineBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingSiteDelete>(null);

  const [editingSite, setEditingSite] = useState<DbSiteRow | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteCode, setEditSiteCode] = useState('');

  const [editingBlock, setEditingBlock] = useState<DbMineBlockRow | null>(null);
  const [editBlockName, setEditBlockName] = useState('');
  const [editBlockCode, setEditBlockCode] = useState('');
  const [editBlockSiteId, setEditBlockSiteId] = useState('');

  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCode, setNewSiteCode] = useState('');

  const [newBlockSiteId, setNewBlockSiteId] = useState<string>('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockCode, setNewBlockCode] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [{ data: sitesData, error: siteErr }, { data: blocksData, error: blockErr }] =
        await Promise.all([
          supabase
            .from('sites')
            .select('id, name, site_code, active')
            .is('deleted_at', null)
            .order('name'),
          supabase
            .from('mine_blocks')
            .select('id, name, code, site_id, active')
            .is('deleted_at', null)
            .order('name'),
        ]);

      if (siteErr) throw siteErr;
      if (blockErr) throw blockErr;

      const nextSites = sitesData || [];
      setDbSites(nextSites);
      setDbBlocks(blocksData || []);
      setNewBlockSiteId((prev) => prev || nextSites[0]?.id || '');
    } catch {
      toast.error('Failed to load sites and mine blocks.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;

    setSaving(true);
    try {
      const res = await adminAddSite({
        name: newSiteName.trim(),
        site_code: newSiteCode.trim() || undefined,
        active: true,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Site "${newSiteName.trim()}" added successfully.`);
        setNewSiteName('');
        setNewSiteCode('');
        await loadData();
      }
    } catch {
      toast.error('Failed to add site.');
    } finally {
      setSaving(false);
    }
  };

  const openEditSite = (site: DbSiteRow) => {
    setEditingSite(site);
    setEditSiteName(site.name);
    setEditSiteCode(site.site_code);
  };

  const handleSaveSiteEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite || !editSiteName.trim() || !editSiteCode.trim()) return;
    setSaving(true);
    try {
      const res = await adminUpdateSite(editingSite.id, {
        name: editSiteName.trim(),
        site_code: editSiteCode.trim().toUpperCase(),
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Site "${editSiteName.trim()}" updated.`);
        setEditingSite(null);
        await loadData();
      }
    } catch {
      toast.error('Failed to update site.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSiteActive = async (site: DbSiteRow) => {
    setSaving(true);
    try {
      const res = await adminUpdateSite(site.id, { active: !site.active });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Site ${site.name} ${site.active ? 'deactivated' : 'activated'}.`);
        await loadData();
      }
    } catch {
      toast.error('Failed to update site.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;

    setSaving(true);
    try {
      const res = await adminAddMineBlock({
        name: newBlockName.trim(),
        code: newBlockCode.trim() || undefined,
        site_id: newBlockSiteId || null,
        active: true,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Block "${newBlockName.trim()}" added successfully.`);
        setNewBlockName('');
        setNewBlockCode('');
        await loadData();
      }
    } catch {
      toast.error('Failed to add mine block.');
    } finally {
      setSaving(false);
    }
  };

  const openEditBlock = (block: DbMineBlockRow) => {
    setEditingBlock(block);
    setEditBlockName(block.name);
    setEditBlockCode(block.code);
    setEditBlockSiteId(block.site_id ?? '');
  };

  const handleSaveBlockEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlock || !editBlockName.trim() || !editBlockCode.trim()) return;
    setSaving(true);
    try {
      const res = await adminUpdateMineBlock(editingBlock.id, {
        name: editBlockName.trim(),
        code: editBlockCode.trim().toUpperCase(),
        site_id: editBlockSiteId || null,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Block "${editBlockName.trim()}" updated.`);
        setEditingBlock(null);
        await loadData();
      }
    } catch {
      toast.error('Failed to update mine block.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlockActive = async (block: DbMineBlockRow) => {
    setSaving(true);
    try {
      const res = await adminUpdateMineBlock(block.id, { active: !block.active });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Block ${block.name} ${block.active ? 'deactivated' : 'activated'}.`);
        await loadData();
      }
    } catch {
      toast.error('Failed to update mine block.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      if (pendingDelete.kind === 'site') {
        const res = await adminDeleteSite(pendingDelete.row.id);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success(
            res.resolution === 'deactivated'
              ? `Site "${pendingDelete.row.name}" is referenced by logs and was deactivated.`
              : `Site "${pendingDelete.row.name}" removed.`
          );
          setPendingDelete(null);
          await loadData();
        }
        return;
      }

      const res = await adminDeleteMineBlock(pendingDelete.row.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          res.resolution === 'deactivated'
            ? `Block "${pendingDelete.row.name}" is referenced by logs and was deactivated.`
            : `Block "${pendingDelete.row.name}" removed.`
        );
        setPendingDelete(null);
        await loadData();
      }
    } catch {
      toast.error(
        pendingDelete.kind === 'site' ? 'Failed to remove site.' : 'Failed to remove mine block.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: SITES MANAGEMENT */}
      <div className="space-y-4">
        <GlassCard
          data-testid="sites-adding-panel"
          className="gold-steel-border gold-steel-border-slim p-4 sm:px-5 sm:py-3.5"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-[var(--text-heading)] text-base leading-tight">
                  Sites &amp; Locations
                </h2>
                <p className="truncate text-[var(--text-muted)] text-xs">
                  Operational complex sites connected directly to excavator and hauling logs.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddSite}
              className="grid w-full shrink-0 grid-cols-1 items-center gap-2.5 sm:grid-cols-[minmax(180px,220px)_minmax(120px,140px)_auto] lg:w-auto"
            >
              <Input
                placeholder="Site Name (e.g. North Pit)"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                wrapperClassName="w-full"
                className="h-9 w-full border-[var(--border-default)] bg-[var(--bg-secondary)] text-xs"
              />
              <Input
                placeholder="Code (e.g. PIT-NP)"
                value={newSiteCode}
                onChange={(e) => setNewSiteCode(e.target.value)}
                wrapperClassName="w-full"
                className="h-9 w-full border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono text-xs"
              />
              <Button
                type="submit"
                disabled={saving || !newSiteName.trim()}
                className="h-9 shrink-0 bg-[var(--accent-emerald)] px-4 font-semibold text-[var(--bg-void)] text-xs hover:bg-[var(--accent-green)]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Site
              </Button>
            </form>
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-8 text-center text-[var(--text-muted)] text-xs">
              Loading sites...
            </div>
          ) : dbSites.length === 0 ? (
            <div className="px-6 py-12 text-center text-[var(--text-muted)]">
              No sites found in database.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-default)]" aria-label="Sites list">
              {dbSites.map((site) => (
                <li
                  key={site.id}
                  className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 shrink-0 text-[var(--accent-emerald)]" />
                    <span className="font-semibold text-[var(--text-heading)] text-sm">
                      {site.name}
                    </span>
                    <span className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                      {site.site_code}
                    </span>
                    {site.active ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[11px] text-accent-green">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-[11px] text-[var(--text-muted)]">
                        <XCircle className="h-3.5 w-3.5" /> Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      aria-label={`Edit ${site.name}`}
                      onClick={() => openEditSite(site)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => handleToggleSiteActive(site)}
                      className="text-xs"
                    >
                      {site.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      aria-label={`Remove ${site.name}`}
                      className="text-accent-red hover:text-accent-red/80"
                      onClick={() => setPendingDelete({ kind: 'site', row: site })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* SECTION 2: MINE BLOCKS MANAGEMENT */}
      <div className="space-y-4 border-[var(--border-default)] border-t pt-4">
        <GlassCard
          data-testid="blocks-adding-panel"
          className="gold-steel-border gold-steel-border-slim p-4 sm:px-5 sm:py-3.5"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-[var(--text-heading)] text-base leading-tight">
                  Mine Blocks &amp; Areas
                </h2>
                <p className="truncate text-[var(--text-muted)] text-xs">
                  Mining benches and extraction areas linked to sites, populated into Hourly Loads
                  and Excavator tracking.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddBlock}
              className="grid w-full shrink-0 grid-cols-1 items-center gap-2.5 sm:grid-cols-[minmax(150px,180px)_minmax(190px,220px)_minmax(120px,140px)_auto] lg:w-auto"
            >
              <select
                aria-label="Select site for block"
                value={newBlockSiteId}
                onChange={(e) => setNewBlockSiteId(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              >
                <option value="">Unassigned Site</option>
                {dbSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Block Name (e.g. North Pit Bench B)"
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                wrapperClassName="w-full"
                className="h-9 w-full border-[var(--border-default)] bg-[var(--bg-secondary)] text-xs"
              />
              <Input
                placeholder="Code (e.g. BLK-NP-B)"
                value={newBlockCode}
                onChange={(e) => setNewBlockCode(e.target.value)}
                wrapperClassName="w-full"
                className="h-9 w-full border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono text-xs"
              />
              <Button
                type="submit"
                disabled={saving || !newBlockName.trim()}
                className="h-9 shrink-0 bg-[var(--accent-blue)] px-4 font-semibold text-white text-xs hover:bg-[var(--accent-blue)]/90"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Block
              </Button>
            </form>
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden p-0">
          {dbBlocks.length === 0 ? (
            <div className="px-6 py-12 text-center text-[var(--text-muted)]">
              No mine blocks found in database.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-default)]" aria-label="Mine blocks list">
              {dbBlocks.map((block) => {
                const site = dbSites.find((s) => s.id === block.site_id);
                return (
                  <li
                    key={block.id}
                    className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-[var(--bg-tertiary)]"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="h-4 w-4 shrink-0 text-[var(--accent-blue)]" />
                      <span className="font-semibold text-[var(--text-heading)] text-sm">
                        {block.name}
                      </span>
                      <span className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                        {block.code}
                      </span>
                      {site && (
                        <span className="text-[var(--text-muted)] text-xs">· {site.name}</span>
                      )}
                      {block.active ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[11px] text-accent-green">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-[11px] text-[var(--text-muted)]">
                          <XCircle className="h-3.5 w-3.5" /> Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        aria-label={`Edit ${block.name}`}
                        onClick={() => openEditBlock(block)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => handleToggleBlockActive(block)}
                        className="text-xs"
                      >
                        {block.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        aria-label={`Remove ${block.name}`}
                        className="text-accent-red hover:text-accent-red/80"
                        onClick={() => setPendingDelete({ kind: 'block', row: block })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Edit Site Dialog */}
      <Dialog open={Boolean(editingSite)} onOpenChange={(open) => !open && setEditingSite(null)}>
        <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-primary)]">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Update the site name and code used across pit dispatch and shift reports.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSiteEdit} className="space-y-4">
            <div>
              <label
                htmlFor="edit-site-name"
                className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
              >
                Site Name
              </label>
              <Input
                id="edit-site-name"
                required
                value={editSiteName}
                onChange={(e) => setEditSiteName(e.target.value)}
                className="border-[var(--border-default)] bg-[var(--bg-secondary)]"
              />
            </div>
            <div>
              <label
                htmlFor="edit-site-code"
                className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
              >
                Site Code
              </label>
              <Input
                id="edit-site-code"
                required
                value={editSiteCode}
                onChange={(e) => setEditSiteCode(e.target.value)}
                className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingSite(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !editSiteName.trim() || !editSiteCode.trim()}
                className="bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
              >
                {saving ? 'Saving...' : 'Save Site'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Mine Block Dialog */}
      <Dialog open={Boolean(editingBlock)} onOpenChange={(open) => !open && setEditingBlock(null)}>
        <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-primary)]">
          <DialogHeader>
            <DialogTitle>Edit Mine Block</DialogTitle>
            <DialogDescription>
              Update block name, code, or parent site assignment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveBlockEdit} className="space-y-4">
            <div>
              <label
                htmlFor="edit-block-site"
                className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
              >
                Assigned Site
              </label>
              <select
                id="edit-block-site"
                value={editBlockSiteId}
                onChange={(e) => setEditBlockSiteId(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 text-[var(--text-heading)] text-xs"
              >
                <option value="">Unassigned Site</option>
                {dbSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.site_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="edit-block-name"
                className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
              >
                Block Name
              </label>
              <Input
                id="edit-block-name"
                required
                value={editBlockName}
                onChange={(e) => setEditBlockName(e.target.value)}
                className="border-[var(--border-default)] bg-[var(--bg-secondary)]"
              />
            </div>
            <div>
              <label
                htmlFor="edit-block-code"
                className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
              >
                Block Code
              </label>
              <Input
                id="edit-block-code"
                required
                value={editBlockCode}
                onChange={(e) => setEditBlockCode(e.target.value)}
                className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingBlock(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !editBlockName.trim() || !editBlockCode.trim()}
                className="bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
              >
                {saving ? 'Saving...' : 'Save Block'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingDelete?.kind === 'site' ? 'Remove or Deactivate Site' : 'Remove Mine Block'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              {pendingDelete?.kind === 'site' ? 'or deactivate ' : ''}&ldquo;
              {pendingDelete?.row.name}&rdquo;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => void handleConfirmDelete()}
            >
              Confirm Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
