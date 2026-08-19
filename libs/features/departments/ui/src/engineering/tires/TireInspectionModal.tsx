"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { X, ClipboardCheck, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { logTireInspection } from "./actions";
import type { TireWithInspections } from "./types";

interface TireInspectionModalProps {
  isOpen: boolean;
  tire: TireWithInspections | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TireInspectionModal({
  isOpen,
  tire,
  onClose,
  onSuccess,
}: TireInspectionModalProps) {
  const [isPending, startTransition] = useTransition();
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );
  const [pressurePsi, setPressurePsi] = useState<number>(100);
  const [treadDepthMm, setTreadDepthMm] = useState<number>(50);
  const [conditionStatus, setConditionStatus] = useState<"good" | "warning" | "critical">("good");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !tire) return null;

  const handleTreadChange = (val: number) => {
    setTreadDepthMm(val);
    if (val <= 15) {
      setConditionStatus("critical");
    } else if (val <= 25) {
      setConditionStatus("warning");
    } else {
      setConditionStatus("good");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (pressurePsi <= 0 || pressurePsi > 200) {
      setErrorMsg("Pressure must be between 1 and 200 PSI.");
      return;
    }
    if (treadDepthMm < 0 || treadDepthMm > 150) {
      setErrorMsg("Tread depth must be between 0 and 150 mm.");
      return;
    }

    startTransition(async () => {
      try {
        await logTireInspection({
          tire_id: tire.id,
          inspection_date: inspectionDate,
          pressure_psi: pressurePsi,
          tread_depth_mm: treadDepthMm,
          condition_status: conditionStatus,
          notes: notes.trim() || undefined,
        });
        onSuccess?.();
        onClose();
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to record inspection.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <GlassCard className="w-full max-w-lg p-6 bg-[var(--bg-primary)] border-[var(--border-emphasis)] shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-heading)]">
                Log Tire Inspection
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Serial:{" "}
                <span className="font-mono font-semibold text-[var(--text-heading)]">
                  {tire.serial_number}
                </span>{" "}
                ({tire.brand} {tire.size})
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Inspection Date
              </label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Wheel Position
              </label>
              <input
                type="text"
                disabled
                value={tire.position}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] text-[var(--text-muted)] cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Pressure (PSI)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="200"
                value={pressurePsi}
                onChange={(e) => setPressurePsi(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              />
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                Standard spec: 95–115 PSI
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Tread Depth (mm)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="150"
                value={treadDepthMm}
                onChange={(e) => handleTreadChange(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              />
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                Warning: &le;25mm | Scrap: &le;15mm
              </span>
            </div>
          </div>

          {/* Condition status selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Condition Assessment
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setConditionStatus("good")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  conditionStatus === "good"
                    ? "bg-accent-green/15 border-accent-green text-accent-green"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-muted)]"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Good
              </button>
              <button
                type="button"
                onClick={() => setConditionStatus("warning")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  conditionStatus === "warning"
                    ? "bg-amber-500/15 border-amber-500 text-amber-500"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-muted)]"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Warning
              </button>
              <button
                type="button"
                onClick={() => setConditionStatus("critical")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  conditionStatus === "critical"
                    ? "bg-accent-red/15 border-accent-red text-accent-red"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-muted)]"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Critical
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Field Inspection Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Minor irregular shoulder wear, valve stem cap replaced, no sidewall cuts..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            />
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
              className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 transition-opacity disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Record Inspection"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
