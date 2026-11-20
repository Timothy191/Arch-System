'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_ADMIN_AREAS = ['Office', 'Plant', 'Pit Area', 'All Areas'] as const;

interface DepartmentRow {
  readonly id: string;
  readonly name: string;
  readonly display_name: string | null;
}

export function getSavedAdminAreas(): string[] {
  return [...DEFAULT_ADMIN_AREAS];
}

export function DepartmentsTab() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [newArea, setNewArea] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDepartments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, display_name')
        .is('deleted_at', null)
        .order('display_name', { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setDepartments((data as DepartmentRow[] | null) ?? []);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newArea.trim();
    if (!trimmed) return;

    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (
      departments.some(
        (d) =>
          d.name.toLowerCase() === slug || d.display_name?.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setNewArea('');
      return;
    }

    setErrorMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from('departments')
        .insert({ name: slug, display_name: trimmed })
        .select('id, name, display_name')
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setDepartments((prev) => [...prev, data as DepartmentRow]);
      }
      setNewArea('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create department');
    }
  };

  const handleRemoveArea = async (deptId: string) => {
    setErrorMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase
        .from('departments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deptId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setDepartments((prev) => prev.filter((dept) => dept.id !== deptId));
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to archive department');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="font-medium text-[var(--text-heading)] text-lg">Departments &amp; Areas</h2>

        <form onSubmit={handleAddArea} className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            placeholder="Add new area..."
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            className="w-full border-[var(--border-default)] bg-[var(--bg-secondary)] sm:w-64"
          />
          <Button
            type="submit"
            className="shrink-0 bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Area
          </Button>
        </form>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-rose-700 text-xs">
          {errorMessage}
        </div>
      )}

      <GlassCard className="overflow-hidden p-0">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-[var(--text-muted)]">
            Loading departments…
          </div>
        ) : departments.length === 0 ? (
          <div className="px-6 py-12 text-center text-[var(--text-muted)]">
            No departments or areas found.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]" aria-label="Areas list">
            {departments.map((dept) => {
              const label = dept.display_name || dept.name;
              return (
                <li
                  key={dept.id}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 shrink-0 text-[var(--accent-emerald)]" />
                    <div>
                      <span className="font-medium text-[var(--text-heading)] text-sm">
                        {label}
                      </span>
                      <span className="ml-2 font-mono text-[var(--text-muted)] text-xs">
                        {dept.name}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${label}`}
                    className="text-accent-red hover:text-accent-red/80"
                    onClick={() => void handleRemoveArea(dept.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
