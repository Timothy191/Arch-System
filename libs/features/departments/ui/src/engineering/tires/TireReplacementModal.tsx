"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { X, RefreshCw, AlertTriangle, ArrowRight, ShieldX, PlusCircle } from "lucide-react";
import { replaceTire } from "./actions";
import type { TireWithInspections } from "./types";

interface TireReplacementModalProps {
  isOpen: boolean;
  tire: TireWithInspections | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const SCRAP_REASONS = [
  "Tread Worn Below Limit (<15mm)",
  "Sidewall Cut / Severe Puncture",
  "Impact Burst / Pit Wall Rock Strike",
  "Crown Separation / Delamination",
  "Bead Ring Distortion / Seating Failure",
  "Irregular Cupping / Shoulder Wear Out",
  "Scheduled Preventative Rotation & Scrap",
];

export function TireReplacementModal({
  isOpen,
  tire,
  onClose,
  onSuccess,
}: TireReplacementModalProps) {
  const [isPending, startTransition] = useTransition();
  const [removalDate, setRemovalDate] = useState(new Date().toISOString().split("T")[0] ?? "");
  const [removedHours, setRemovedHours] = useState<number>(
    tire ? tire.installed_hours + 1200 : 2500,
  );
  const [scrappedReason, setScrappedReason] = useState<string>(SCRAP_REASONS[0] ?? "");
  const [customReason, setCustomReason] = useState("");

  // New tire mount fields
  const [installReplacement, setInstallReplacement] = useState(true);
  const [newSerial, setNewSerial] = useState("");
  const [newBrand, setNewBrand] = useState(tire?.brand || "Michelin");
  const [newSize, setNewSize] = useState(tire?.size || "40.00R57");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !tire) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalReason = scrappedReason === "Other" ? customReason.trim() : scrappedReason;
    if (!finalReason) {
      setErrorMsg("Please specify a decommissioning / scrap reason.");
      return;
    }

    if (installReplacement && !newSerial.trim()) {
      setErrorMsg("Please provide the serial number of the replacement tire.");
      return;
    }

    startTransition(async () => {
      try {
        await replaceTire({
          old_tire_id: tire.id,
          removed_at: removalDate,
          removed_hours: removedHours,
          scrapped_reason: finalReason,
          new_tire: installReplacement
            ? {
                serial_number: newSerial.trim(),
                brand: newBrand.trim(),
                size: newSize.trim(),
                machine_id: tire.machine_id,
                position: tire.position,
                status: "installed",
                installed_at: removalDate,
                installed_hours: 0,
              }
            : undefined,
        });
        onSuccess?.();
        onClose();
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to replace tire.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <GlassCard className="w-full max-w-xl p-6 bg-[var(--bg-primary)] border-[var(--border-emphasis)] shadow-window relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent-red/10 text-accent-red">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-heading)]">
                Decommission &amp; Replace Tire
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Active Position:{" "}
                <span className="font-semibold text-[var(--text-heading)]">{tire.position}</span>{" "}
                (Current: {tire.serial_number})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Section 1: Old Tire Scrap Log */}
          <div className="p-4 rounded-xl bg-accent-red/5 border border-accent-red/15 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent-red uppercase tracking-wider">
              <ShieldX className="w-4 h-4" />
              <span>Step 1: Decommission Existing Tire</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[var(--text-muted)]">Serial: </span>
                <span className="font-mono font-semibold text-[var(--text-heading)]">
                  {tire.serial_number}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Spec: </span>
                <span className="font-semibold text-[var(--text-heading)]">
                  {tire.brand} {tire.size}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Removal Date
                </label>
                <input
                  type="date"
                  value={removalDate}
                  onChange={(e) => setRemovalDate(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Cumulative Machine Hours
                </label>
                <input
                  type="number"
                  min="0"
                  value={removedHours}
                  onChange={(e) => setRemovedHours(parseInt(e.target.value, 10) || 0)}
                  required
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Decommission / Scrap Reason
              </label>
              <select
                value={scrappedReason}
                onChange={(e) => setScrappedReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              >
                {SCRAP_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="Other">Other / Specific Incident...</option>
              </select>

              {scrappedReason === "Other" && (
                <input
                  type="text"
                  placeholder="Describe failure reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              )}
            </div>
          </div>

          {/* Section 2: Mount Replacement */}
          <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-heading)] uppercase tracking-wider">
                <PlusCircle className="w-4 h-4 text-[var(--accent-blue)]" />
                <span>Step 2: Mount Replacement Tire</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={installReplacement}
                  onChange={(e) => setInstallReplacement(e.target.checked)}
                  className="rounded border-[var(--border-default)] text-[var(--accent-blue)] focus:ring-[var(--accent-blue)]"
                />
                Mount immediately
              </label>
            </div>

            {installReplacement && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    New Tire Serial Number *
                  </label>
                  <input
                    type="text"
                    required={installReplacement}
                    placeholder="e.g. MICH-XDR2-88492"
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Brand
                    </label>
                    <select
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                    >
                      <option value="Michelin">Michelin</option>
                      <option value="Bridgestone">Bridgestone</option>
                      <option value="Goodyear">Goodyear</option>
                      <option value="Titan">Titan</option>
                      <option value="BKT">BKT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Size Specification
                    </label>
                    <input
                      type="text"
                      required={installReplacement}
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value)}
                      placeholder="e.g. 40.00R57"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent-red text-white hover:bg-accent-red/90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
              <span>{isPending ? "Processing..." : "Confirm Replacement & Scrap"}</span>
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
