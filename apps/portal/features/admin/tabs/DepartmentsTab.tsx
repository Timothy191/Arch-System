'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export const DEFAULT_ADMIN_AREAS = ['Office', 'Plant', 'Pit Area', 'All Areas'] as const;
const AREAS_STORAGE_KEY = 'arch_admin_areas';

export function getSavedAdminAreas(): string[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_ADMIN_AREAS];
  }
  try {
    const raw = localStorage.getItem(AREAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    }
  } catch {
    // Fallback to defaults if storage cannot be parsed
  }
  return [...DEFAULT_ADMIN_AREAS];
}

export function DepartmentsTab() {
  const [areas, setAreas] = useState<string[]>([...DEFAULT_ADMIN_AREAS]);
  const [newArea, setNewArea] = useState('');

  useEffect(() => {
    setAreas(getSavedAdminAreas());
  }, []);

  const persistAreas = (nextAreas: string[]) => {
    setAreas(nextAreas);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(nextAreas));
    }
  };

  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newArea.trim();
    if (!trimmed) return;
    if (areas.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setNewArea('');
      return;
    }
    persistAreas([...areas, trimmed]);
    setNewArea('');
  };

  const handleRemoveArea = (areaToRemove: string) => {
    persistAreas(areas.filter((area) => area !== areaToRemove));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-[var(--text-heading)]">Areas</h2>

        <form onSubmit={handleAddArea} className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Add new area..."
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            className="w-full sm:w-64 bg-[var(--bg-secondary)] border-[var(--border-default)]"
          />
          <Button
            type="submit"
            className="shrink-0 bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Area
          </Button>
        </form>
      </div>

      <GlassCard className="overflow-hidden p-0">
        {areas.length === 0 ? (
          <div className="px-6 py-12 text-center text-[var(--text-muted)]">No areas added.</div>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]" aria-label="Areas list">
            {areas.map((area) => (
              <li
                key={area}
                className="flex items-center justify-between px-6 py-4 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[var(--accent-emerald)] shrink-0" />
                  <span className="text-sm font-medium text-[var(--text-heading)]">{area}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Remove ${area}`}
                  className="text-accent-red hover:text-accent-red/80"
                  onClick={() => handleRemoveArea(area)}
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
