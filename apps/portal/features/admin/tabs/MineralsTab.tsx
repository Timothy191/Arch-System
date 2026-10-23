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
        <h2 className="text-lg font-medium text-[var(--text-heading)]">
          Minerals & Materials Register
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Register operational mineral sub-categories for Waste and Coal. These options
          automatically populate the excavator material mapping dropdowns across the portal.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-[var(--text-muted)]">
          Loading mineral register...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WASTE MINERALS SECTION */}
          <GlassCard className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent-blue)]" />
                <h3 className="text-sm font-semibold text-[var(--text-heading)]">
                  Waste Minerals ({wasteMinerals.length})
                </h3>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Category: Waste
              </span>
            </div>

            <form onSubmit={handleAddWaste} className="flex items-center gap-2">
              <Input
                placeholder="e.g. Dyke, Overburden, Topsoil..."
                value={newWasteMineral}
                onChange={(e) => setNewWasteMineral(e.target.value)}
                className="bg-[var(--bg-primary)] border-[var(--border-default)] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={saving || !newWasteMineral.trim()}
                className="shrink-0 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </form>

            <ul className="divide-y divide-[var(--border-default)]/60 rounded-lg border border-[var(--border-default)] overflow-hidden">
              {wasteMinerals.map((mineral) => (
                <li
                  key={mineral}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-xs"
                >
                  <span className="font-medium text-[var(--text-heading)]">{mineral}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemoveWaste(mineral)}
                    className="text-[var(--text-muted)] hover:text-accent-red transition-colors p-1"
                    title={`Remove ${mineral}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>

          {/* COAL MINERALS SECTION */}
          <GlassCard className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <Gem className="w-4 h-4 text-neutral-800" />
                <h3 className="text-sm font-semibold text-[var(--text-heading)]">
                  Coal Minerals ({coalMinerals.length})
                </h3>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">Category: Coal</span>
            </div>

            <form onSubmit={handleAddCoal} className="flex items-center gap-2">
              <Input
                placeholder="e.g. 2#Lower, 4#Upper, Seam 1..."
                value={newCoalMineral}
                onChange={(e) => setNewCoalMineral(e.target.value)}
                className="bg-[var(--bg-primary)] border-[var(--border-default)] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={saving || !newCoalMineral.trim()}
                className="shrink-0 bg-neutral-800 hover:bg-neutral-900 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </form>

            <ul className="divide-y divide-[var(--border-default)]/60 rounded-lg border border-[var(--border-default)] overflow-hidden">
              {coalMinerals.map((mineral) => (
                <li
                  key={mineral}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-xs"
                >
                  <span className="font-medium text-[var(--text-heading)]">{mineral}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemoveCoal(mineral)}
                    className="text-[var(--text-muted)] hover:text-accent-red transition-colors p-1"
                    title={`Remove ${mineral}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
