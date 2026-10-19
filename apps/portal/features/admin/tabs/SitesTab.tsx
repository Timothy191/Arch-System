'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { adminAddSite, adminDeleteSite } from '../actions/sites';

export const DEFAULT_ADMIN_SITES = [
  'Brakfontein Pit',
  'Brakfontein Plant',
  'Extension Pit',
] as const;

const SITES_STORAGE_KEY = 'arch_admin_sites';

export function getSavedAdminSites(): string[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_ADMIN_SITES];
  }
  try {
    const raw = localStorage.getItem(SITES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    }
  } catch {
    // Fallback to defaults if storage cannot be parsed
  }
  return [...DEFAULT_ADMIN_SITES];
}

interface DbSiteRow {
  id: string;
  name: string;
  site_code: string;
  active: boolean;
}

export function SitesTab() {
  const supabase = createBrowserSupabaseClient();
  const [sites, setSites] = useState<string[]>([...DEFAULT_ADMIN_SITES]);
  const [dbSites, setDbSites] = useState<DbSiteRow[]>([]);
  const [newSite, setNewSite] = useState('');
  const [saving, setSaving] = useState(false);

  const persistSites = useCallback((nextSites: string[]) => {
    setSites(nextSites);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SITES_STORAGE_KEY, JSON.stringify(nextSites));
    }
  }, []);

  const loadSites = useCallback(async () => {
    const localSites = getSavedAdminSites();
    const { data: siteData } = await supabase
      .from('sites')
      .select('id, name, site_code, active')
      .eq('active', true)
      .order('name');

    if (siteData && siteData.length > 0) {
      setDbSites(siteData);
      const merged = [...localSites];
      for (const row of siteData) {
        if (!merged.some((s) => s.toLowerCase() === row.name.toLowerCase())) {
          merged.push(row.name);
        }
      }
      persistSites(merged);
    } else {
      persistSites(localSites);
    }
  }, [supabase, persistSites]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidates = newSite
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (candidates.length === 0) return;

    const updated = [...sites];
    const newlyAdded: string[] = [];

    for (const candidate of candidates) {
      if (!updated.some((s) => s.toLowerCase() === candidate.toLowerCase())) {
        updated.push(candidate);
        newlyAdded.push(candidate);
      }
    }

    setNewSite('');
    if (newlyAdded.length === 0) return;

    persistSites(updated);
    setSaving(true);
    await Promise.all(newlyAdded.map((siteName) => adminAddSite({ name: siteName, active: true })));
    await loadSites();
    setSaving(false);
  };

  const handleRemoveSite = async (siteToRemove: string) => {
    const nextSites = sites.filter((site) => site !== siteToRemove);
    persistSites(nextSites);

    const matchingDb = dbSites.find((s) => s.name.toLowerCase() === siteToRemove.toLowerCase());
    if (matchingDb) {
      setSaving(true);
      await adminDeleteSite(matchingDb.id);
      await loadSites();
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-[var(--text-heading)]">Sites</h2>

        <form onSubmit={handleAddSite} className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="e.g. Brakfontein Pit, Brakfontein Plant, Extension Pit"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            className="w-full sm:w-80 bg-[var(--bg-secondary)] border-[var(--border-default)]"
          />
          <Button
            type="submit"
            disabled={saving}
            className="shrink-0 bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </Button>
        </form>
      </div>

      <GlassCard className="overflow-hidden p-0">
        {sites.length === 0 ? (
          <div className="px-6 py-12 text-center text-[var(--text-muted)]">No sites added.</div>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]" aria-label="Sites list">
            {sites.map((site) => (
              <li
                key={site}
                className="flex items-center justify-between px-6 py-4 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[var(--accent-emerald)] shrink-0" />
                  <span className="text-sm font-medium text-[var(--text-heading)]">{site}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  aria-label={`Remove ${site}`}
                  className="text-accent-red hover:text-accent-red/80"
                  onClick={() => handleRemoveSite(site)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
