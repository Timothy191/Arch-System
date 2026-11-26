'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Check, Edit2, Gem, Layers, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminSaveMineralRegistry, getMineralRegistry } from '../actions/minerals';

const DEFAULT_WASTE_MINERALS: readonly string[] = [
  'Dyke',
  'Overburden',
  'Interburden',
  'Topsoil',
  'Waste',
  'Other',
];

const DEFAULT_COAL_MINERALS: readonly string[] = [
  '2#Lower',
  '2#Upper',
  '4#Lower',
  '4#Upper',
  'Seam 1',
  'Seam 2',
  'Raw Coal',
  'Other',
];

interface EditingMineralState {
  readonly category: 'waste' | 'coal';
  readonly originalName: string;
  readonly draftName: string;
}

export function MineralsTab() {
  const [wasteMinerals, setWasteMinerals] = useState<string[]>([...DEFAULT_WASTE_MINERALS]);
  const [coalMinerals, setCoalMinerals] = useState<string[]>([...DEFAULT_COAL_MINERALS]);
  const [newWasteMineral, setNewWasteMineral] = useState('');
  const [newCoalMineral, setNewCoalMineral] = useState('');
  const [editingMineral, setEditingMineral] = useState<EditingMineralState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const reg = await getMineralRegistry();
        if (reg?.waste?.length) setWasteMinerals(reg.waste);
        if (reg?.coal?.length) setCoalMinerals(reg.coal);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load mineral registry');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const persistRegistry = async (options: {
    nextWaste: string[];
    nextCoal: string[];
    prevWaste: string[];
    prevCoal: string[];
  }) => {
    setSaving(true);
    try {
      const res = await adminSaveMineralRegistry({
        waste: options.nextWaste,
        coal: options.nextCoal,
      });
      if (res?.error) {
        setWasteMinerals(options.prevWaste);
        setCoalMinerals(options.prevCoal);
        toast.error(res.error);
        return false;
      }
      toast.success('Mineral registry updated.');
      return true;
    } catch {
      setWasteMinerals(options.prevWaste);
      setCoalMinerals(options.prevCoal);
      toast.error('Failed to save mineral registry.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = newWasteMineral.trim();
    if (!candidate) return;
    if (wasteMinerals.some((m) => m.toLowerCase() === candidate.toLowerCase())) {
      toast.error(`"${candidate}" is already registered under Waste.`);
      return;
    }
    const prevWaste = wasteMinerals;
    const prevCoal = coalMinerals;
    const next = [...wasteMinerals, candidate];
    setWasteMinerals(next);
    const saved = await persistRegistry({
      nextWaste: next,
      nextCoal: coalMinerals,
      prevWaste,
      prevCoal,
    });
    if (saved) setNewWasteMineral('');
  };

  const handleRemoveWaste = async (mineralToRemove: string) => {
    if (wasteMinerals.length <= 1) {
      toast.error('At least one waste mineral must remain registered.');
      return;
    }
    const prevWaste = wasteMinerals;
    const prevCoal = coalMinerals;
    const next = wasteMinerals.filter((m) => m !== mineralToRemove);
    setWasteMinerals(next);
    await persistRegistry({
      nextWaste: next,
      nextCoal: coalMinerals,
      prevWaste,
      prevCoal,
    });
  };

  const handleAddCoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = newCoalMineral.trim();
    if (!candidate) return;
    if (coalMinerals.some((m) => m.toLowerCase() === candidate.toLowerCase())) {
      toast.error(`"${candidate}" is already registered under Coal.`);
      return;
    }
    const prevWaste = wasteMinerals;
    const prevCoal = coalMinerals;
    const next = [...coalMinerals, candidate];
    setCoalMinerals(next);
    const saved = await persistRegistry({
      nextWaste: wasteMinerals,
      nextCoal: next,
      prevWaste,
      prevCoal,
    });
    if (saved) setNewCoalMineral('');
  };

  const handleRemoveCoal = async (mineralToRemove: string) => {
    if (coalMinerals.length <= 1) {
      toast.error('At least one coal mineral must remain registered.');
      return;
    }
    const prevWaste = wasteMinerals;
    const prevCoal = coalMinerals;
    const next = coalMinerals.filter((m) => m !== mineralToRemove);
    setCoalMinerals(next);
    await persistRegistry({
      nextWaste: wasteMinerals,
      nextCoal: next,
      prevWaste,
      prevCoal,
    });
  };

  const handleCommitRename = async () => {
    if (!editingMineral) return;
    const trimmed = editingMineral.draftName.trim();
    if (!trimmed) {
      toast.error('Mineral name cannot be empty.');
      return;
    }
    if (trimmed === editingMineral.originalName) {
      setEditingMineral(null);
      return;
    }

    const list = editingMineral.category === 'waste' ? wasteMinerals : coalMinerals;
    const hasDuplicate = list.some(
      (item) => item !== editingMineral.originalName && item.toLowerCase() === trimmed.toLowerCase()
    );
    if (hasDuplicate) {
      toast.error(`"${trimmed}" is already registered in this category.`);
      return;
    }

    const prevWaste = wasteMinerals;
    const prevCoal = coalMinerals;
    const nextWaste =
      editingMineral.category === 'waste'
        ? wasteMinerals.map((item) => (item === editingMineral.originalName ? trimmed : item))
        : wasteMinerals;
    const nextCoal =
      editingMineral.category === 'coal'
        ? coalMinerals.map((item) => (item === editingMineral.originalName ? trimmed : item))
        : coalMinerals;

    setWasteMinerals(nextWaste);
    setCoalMinerals(nextCoal);
    setEditingMineral(null);

    await persistRegistry({
      nextWaste,
      nextCoal,
      prevWaste,
      prevCoal,
    });
  };

  const renderMineralRow = (category: 'waste' | 'coal', mineral: string) => {
    const isEditing =
      editingMineral?.category === category && editingMineral.originalName === mineral;

    if (isEditing) {
      return (
        <li
          key={mineral}
          className="flex items-center justify-between gap-2 bg-[var(--bg-secondary)] px-3 py-2 text-xs"
        >
          <Input
            aria-label={`Rename ${mineral}`}
            value={editingMineral.draftName}
            onChange={(e) => setEditingMineral({ ...editingMineral, draftName: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCommitRename();
              }
              if (e.key === 'Escape') {
                setEditingMineral(null);
              }
            }}
            className="h-7 flex-1 border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={saving}
              aria-label={`Save rename for ${mineral}`}
              onClick={() => void handleCommitRename()}
              className="rounded p-1 text-accent-green transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={saving}
              aria-label={`Cancel rename for ${mineral}`}
              onClick={() => setEditingMineral(null)}
              className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </li>
      );
    }

    return (
      <li
        key={mineral}
        className="flex items-center justify-between bg-[var(--bg-secondary)] px-3.5 py-2.5 text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
      >
        <span className="font-medium text-[var(--text-heading)]">{mineral}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setEditingMineral({
                category,
                originalName: mineral,
                draftName: mineral,
              })
            }
            className="p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-heading)]"
            title={`Rename ${mineral}`}
            aria-label={`Rename ${mineral}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              category === 'waste'
                ? void handleRemoveWaste(mineral)
                : void handleRemoveCoal(mineral)
            }
            className="p-1 text-[var(--text-muted)] transition-colors hover:text-accent-red"
            title={`Remove ${mineral}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-[var(--text-heading)] text-lg">
          Minerals &amp; Materials Register
        </h2>
        <p className="text-[var(--text-muted)] text-xs">
          Register operational mineral sub-categories for Waste and Coal. These options
          automatically populate the excavator material mapping dropdowns across the portal.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)] text-xs">
          Loading mineral register...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* WASTE MINERALS SECTION */}
          <GlassCard className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--accent-blue)]" />
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Waste Minerals ({wasteMinerals.length})
                </h3>
              </div>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                Category: Waste
              </span>
            </div>

            <form onSubmit={handleAddWaste} className="flex items-center gap-2">
              <Input
                placeholder="e.g. Dyke, Overburden, Topsoil..."
                value={newWasteMineral}
                onChange={(e) => setNewWasteMineral(e.target.value)}
                className="border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={saving || !newWasteMineral.trim()}
                className="shrink-0 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </form>

            <ul className="divide-y divide-[var(--border-default)]/60 overflow-hidden rounded-lg border border-[var(--border-default)]">
              {wasteMinerals.map((mineral) => renderMineralRow('waste', mineral))}
            </ul>
          </GlassCard>

          {/* COAL MINERALS SECTION */}
          <GlassCard className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-3">
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4 text-accent-gold" />
                <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                  Coal Minerals ({coalMinerals.length})
                </h3>
              </div>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">Category: Coal</span>
            </div>

            <form onSubmit={handleAddCoal} className="flex items-center gap-2">
              <Input
                placeholder="e.g. 2#Lower, 4#Upper, Seam 1..."
                value={newCoalMineral}
                onChange={(e) => setNewCoalMineral(e.target.value)}
                className="border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={saving || !newCoalMineral.trim()}
                className="shrink-0 bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </form>

            <ul className="divide-y divide-[var(--border-default)]/60 overflow-hidden rounded-lg border border-[var(--border-default)]">
              {coalMinerals.map((mineral) => renderMineralRow('coal', mineral))}
            </ul>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
