'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Gem, Layers, Plus, Trash2 } from 'lucide-react';
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

export function MineralsTab() {
  const [wasteMinerals, setWasteMinerals] = useState<string[]>([...DEFAULT_WASTE_MINERALS]);
  const [coalMinerals, setCoalMinerals] = useState<string[]>([...DEFAULT_COAL_MINERALS]);
  const [newWasteMineral, setNewWasteMineral] = useState('');
  const [newCoalMineral, setNewCoalMineral] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const reg = await getMineralRegistry();
        if (reg?.waste?.length) setWasteMinerals(reg.waste);
        if (reg?.coal?.length) setCoalMinerals(reg.coal);
      } catch {
        toast.error('Failed to load mineral registry');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const persistRegistry = async (nextWaste: string[], nextCoal: string[]) => {
    setSaving(true);
    try {
      const res = await adminSaveMineralRegistry({
        waste: nextWaste,
        coal: nextCoal,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Mineral registry updated.');
      }
    } catch {
      toast.error('Failed to save mineral registry.');
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
    const next = [...wasteMinerals, candidate];
    setWasteMinerals(next);
    setNewWasteMineral('');
    await persistRegistry(next, coalMinerals);
  };

  const handleRemoveWaste = async (mineralToRemove: string) => {
    if (wasteMinerals.length <= 1) {
      toast.error('At least one waste mineral must remain registered.');
      return;
    }
    const next = wasteMinerals.filter((m) => m !== mineralToRemove);
    setWasteMinerals(next);
    await persistRegistry(next, coalMinerals);
  };

  const handleAddCoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = newCoalMineral.trim();
    if (!candidate) return;
    if (coalMinerals.some((m) => m.toLowerCase() === candidate.toLowerCase())) {
      toast.error(`"${candidate}" is already registered under Coal.`);
      return;
    }
    const next = [...coalMinerals, candidate];
    setCoalMinerals(next);
    setNewCoalMineral('');
    await persistRegistry(wasteMinerals, next);
  };

  const handleRemoveCoal = async (mineralToRemove: string) => {
    if (coalMinerals.length <= 1) {
      toast.error('At least one coal mineral must remain registered.');
      return;
    }
    const next = coalMinerals.filter((m) => m !== mineralToRemove);
    setCoalMinerals(next);
    await persistRegistry(wasteMinerals, next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-[var(--text-heading)] text-lg">
          Minerals & Materials Register
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
              {wasteMinerals.map((mineral) => (
                <li
                  key={mineral}
                  className="flex items-center justify-between bg-[var(--bg-secondary)] px-3.5 py-2.5 text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  <span className="font-medium text-[var(--text-heading)]">{mineral}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemoveWaste(mineral)}
                    className="p-1 text-[var(--text-muted)] transition-colors hover:text-accent-red"
                    title={`Remove ${mineral}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>

          {/* COAL MINERALS SECTION */}
          <GlassCard className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-3">
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4 text-neutral-800" />
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
                className="shrink-0 bg-neutral-800 text-white hover:bg-neutral-900"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </form>

            <ul className="divide-y divide-[var(--border-default)]/60 overflow-hidden rounded-lg border border-[var(--border-default)]">
              {coalMinerals.map((mineral) => (
                <li
                  key={mineral}
                  className="flex items-center justify-between bg-[var(--bg-secondary)] px-3.5 py-2.5 text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  <span className="font-medium text-[var(--text-heading)]">{mineral}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemoveCoal(mineral)}
                    className="p-1 text-[var(--text-muted)] transition-colors hover:text-accent-red"
                    title={`Remove ${mineral}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
