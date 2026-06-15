"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { useRouter } from "next/navigation";
import {
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  UserCheck,
  Lock,
} from "lucide-react";
import { verifyPin, closeShift } from "~/lib/shift-closeout";

interface CloseShiftModalProps {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  departmentSlug: string;
  date: string;
  shiftType: "day" | "night";
  onComplete: () => void;
}

type ModalState =
  | { type: "validating" }
  | { type: "has_errors"; errors: string[] }
  | { type: "pin_entry" }
  | { type: "verifying" }
  | { type: "verified"; employeeId: string; employeeName: string }
  | { type: "submitting" }
  | { type: "success" }
  | { type: "api_error"; message: string };

export function CloseShiftModal({
  open,
  onClose,
  departmentId,
  departmentSlug,
  date,
  shiftType,
  onComplete,
}: CloseShiftModalProps) {
  const router = useRouter();
  const [state, setState] = useState<ModalState>({ type: "validating" });
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");

  const validate = useCallback(async () => {
    setState({ type: "validating" });
    try {
      const result = await closeShift(
        departmentId,
        date,
        shiftType,
        "",
        "",
        true,
      );
      if (result.errors && result.errors.length > 0) {
        setState({ type: "has_errors", errors: result.errors });
      } else {
        setState({ type: "pin_entry" });
      }
    } catch (err) {
      setState({
        type: "api_error",
        message: err instanceof Error ? err.message : "Validation failed",
      });
    }
  }, [departmentId, date, shiftType]);

  useEffect(() => {
    if (open) {
      setEmployeeCode("");
      setPin("");
      validate();
    }
  }, [open, validate]);

  const handleVerify = async () => {
    if (!employeeCode || !pin) return;
    setState({ type: "verifying" });
    try {
      const result = await verifyPin(employeeCode, pin);
      if (result.valid && result.employee) {
        setState({
          type: "verified",
          employeeId: result.employee.id,
          employeeName: result.employee.full_name,
        });
      } else {
        setState({
          type: "api_error",
          message: "Invalid employee code or PIN",
        });
      }
    } catch (err) {
      setState({
        type: "api_error",
        message: err instanceof Error ? err.message : "Verification failed",
      });
    }
  };

  const handleCloseShift = async () => {
    if (state.type !== "verified") return;
    setState({ type: "submitting" });
    try {
      const result = await closeShift(
        departmentId,
        date,
        shiftType,
        state.employeeId,
        pin,
        false,
        departmentSlug,
      );
      if (result.success) {
        setState({ type: "success" });
        router.refresh();
        setTimeout(() => {
          onComplete();
          onClose();
        }, 2000);
      } else {
        setState({
          type: "api_error",
          message: result.errors?.join(", ") || "Failed to close shift",
        });
      }
    } catch (err) {
      setState({
        type: "api_error",
        message: err instanceof Error ? err.message : "Failed to close shift",
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--text-heading)]">
            Close Shift
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {state.type === "validating" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-[var(--accent-cyan)] animate-spin" />
            <p className="text-[var(--text-muted)] text-sm">
              Validating shift data...
            </p>
          </div>
        )}

        {state.type === "has_errors" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
              <div>
                <p className="text-accent-red text-sm font-medium mb-2">
                  Cannot close shift until the following are resolved:
                </p>
                <ul className="space-y-1">
                  {state.errors.map((err, i) => (
                    <li
                      key={i}
                      className="text-accent-red/80 text-xs flex items-start gap-2"
                    >
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-accent-red shrink-0" />
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] font-medium rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
            >
              Close
            </button>
          </div>
        )}

        {(state.type === "pin_entry" || state.type === "verifying") && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 bg-accent-green/10 border border-accent-green/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-accent-green shrink-0" />
              <p className="text-accent-green text-sm">
                All machines accounted for. Supervisor PIN required to close.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-[var(--text-secondary)]">
                Employee Code
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="e.g. EMP001"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-[var(--text-secondary)]">
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter supervisor PIN"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={state.type === "verifying" || !employeeCode || !pin}
              className="w-full flex items-center justify-center gap-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-[var(--bg-secondary)] font-medium py-2.5 rounded-lg transition-colors"
            >
              {state.type === "verifying" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Verify PIN
                </>
              )}
            </button>
          </div>
        )}

        {state.type === "verified" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 bg-accent-green/10 border border-accent-green/20 rounded-lg">
              <UserCheck className="w-5 h-5 text-accent-green shrink-0" />
              <div>
                <p className="text-accent-green text-sm font-medium">
                  Approved by
                </p>
                <p className="text-accent-green text-sm">
                  {state.employeeName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseShift}
              className="w-full flex items-center justify-center gap-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-[var(--bg-secondary)] font-medium py-2.5 rounded-lg transition-colors"
            >
              <Lock className="w-4 h-4" />
              Close Shift & Lock
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-muted)] font-medium rounded-lg hover:text-[var(--text-heading)] transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {state.type === "submitting" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-[var(--accent-blue)] animate-spin" />
            <p className="text-[var(--text-muted)] text-sm">Closing shift...</p>
          </div>
        )}

        {state.type === "success" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle className="w-12 h-12 text-accent-green" />
            <p className="text-accent-green font-medium text-lg">
              Shift closed successfully
            </p>
          </div>
        )}

        {state.type === "api_error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
              <p className="text-accent-red/80 text-sm">{state.message}</p>
            </div>
            <button
              type="button"
              onClick={validate}
              className="w-full py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] font-medium rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
