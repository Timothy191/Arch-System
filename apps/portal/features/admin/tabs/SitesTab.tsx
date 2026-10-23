'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { CheckCircle2, Layers, MapPin, Plus, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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

export function SitesTab() {
  const supabase = createBrowserSupabaseClient();
  const [dbSites, setDbSites] = useState<DbSiteRow[]>([]);
  const [dbBlocks, setDbBlocks] = useState<DbMineBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New site form state
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCode, setNewSiteCode] = useState('');

  // New mine block form state
  const [newBlockSiteId, setNewBlockSiteId] = useState<string>('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockCode, setNewBlockCode] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [{ data: sitesData, error: siteErr }, { data: blocksData, error: blockErr }] =
        await Promise.all([
          supabase.from('sites').select('id, name, site_code, active').order('name'),
          supabase.from('mine_blocks').select('id, name, code, site_id, active').order('name'),
        ]);

      if (siteErr) throw siteErr;
      if (blockErr) throw blockErr;

      setDbSites(sitesData || []);
      setDbBlocks(blocksData || []);
      if (!newBlockSiteId && sitesData && sitesData.length > 0) {
        setNewBlockSiteId(sitesData[0]?.id ?? '');
      }
    } catch (err) {
      toast.error('Failed to load sites and mine blocks.');
    } finally {
      setLoading(false);
    }
  }, [supabase, newBlockSiteId]);

  useEffect(() => {
    loadData();
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

  const handleDeleteSite = async (site: DbSiteRow) => {
    if (!window.confirm(`Are you sure you want to remove or deactivate "${site.name}"?`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await adminDeleteSite(site.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Site "${site.name}" removed.`);
        await loadData();
      }
    } catch {
      toast.error('Failed to remove site.');
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

  const handleDeleteBlock = async (block: DbMineBlockRow) => {
    if (!window.confirm(`Are you sure you want to remove "${block.name}"?`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await adminDeleteMineBlock(block.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Block "${block.name}" removed.`);
        await loadData();
      }
    } catch {
      toast.error('Failed to remove mine block.');
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
                  Sites & Locations
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
                      <span className="inline-flex items-center gap-1 font-medium text-[11px] text-emerald-600">
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
                      onClick={() => handleDeleteSite(site)}
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
                  Mine Blocks & Areas
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
                        <span className="inline-flex items-center gap-1 font-medium text-[11px] text-emerald-600">
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
                        onClick={() => handleDeleteBlock(block)}
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
    </div>
  );
}
