"use client";

import { useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { X, Lock, AlertCircle, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import type { LockAndSignShiftInput } from "@repo/contract/types/shift-compilation.types";

interface UnifiedShiftCloseoutModalProps {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  departmentSlug: string;
  shiftDate: string;
  shiftType: "day" | "night";
  onSignShift: (
    payload: LockAndSignShiftInput & { departmentSlug?: string },
  ) => Promise<{ success: boolean; error?: string }>;
  onSuccess: () => void;
}

export function UnifiedShiftCloseoutModal({
  open,
  onClose,
  departmentId,
  departmentSlug,
  shiftDate,
  shiftType,
  onSignShift,
  onSuccess,
}: UnifiedShiftCloseoutModalProps) {
  const [pin, setPin] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMessage("Supervisor PIN is required to close out shift.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await onSignShift({
        departmentId,
        shiftDate,
        shiftType,
        pin: pin.trim(),
        notes: notes.trim() || undefined,
        departmentSlug,
      });

      if (!result.success) {
        setErrorMessage(result.error || "Failed to sign and close shift.");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <GlassCard className="w-full max-w-md overflow-hidden border border-black/[0.1] shadow-window bg-white/95 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-6 py-4 bg-neutral-50/70">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 text-sm">
            <Lock className="h-4 w-4 text-neutral-700" />
            <span>Lock & Sign Unified Shift</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/70 space-y-1">
            <div className="text-neutral-500 font-medium">Shift Scope:</div>
            <div className="font-semibold text-neutral-900 flex items-center justify-between">
              <span>{shiftDate}</span>
              <span className="uppercase text-[11px] px-2 py-0.5 rounded bg-neutral-200/80 text-neutral-800">
                {shiftType} Shift
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 pt-1">
              Signing locks this operational period. Loads, SMU hours, breakdowns, and tire records
              will be permanently archived.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-semibold text-neutral-800">
              Supervisor Security PIN <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="h-4 w-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="password"
                maxLength={20}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit or supervisor PIN"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-black/[0.1] bg-white text-neutral-900 font-mono tracking-widest outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-semibold text-neutral-800">
              Compilation Sign-off Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational remarks, weather anomalies, or shift turnover notes..."
              className="w-full p-2.5 rounded-lg border border-black/[0.1] bg-white text-neutral-900 outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 resize-none"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-100 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying & Locking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sign & Finalize Shift
                </>
              )}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
