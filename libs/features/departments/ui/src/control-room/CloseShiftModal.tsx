'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { AlertCircle, CheckCircle, Loader2, Lock, UserCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export interface CloseShiftResult {
  success?: boolean;
  errors?: string[];
  shiftStatusId?: string;
}

export interface VerifyPinResult {
  valid: boolean;
  employee?: { id: string; full_name: string } | null;
  lockedOut?: boolean;
  message?: string;
}

export type CloseShiftFn = (
  departmentId: string,
  date: string,
  shiftType: 'day' | 'night',
  approvedById: string,
  pin: string,
  validateOnly?: boolean,
  departmentSlug?: string
) => Promise<CloseShiftResult>;

export type VerifyPinFn = (employeeCode: string, pin: string) => Promise<VerifyPinResult>;

export interface CloseShiftModalProps {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  departmentSlug: string;
  date: string;
  shiftType: 'day' | 'night';
  onComplete: () => void;
  onCloseShift: CloseShiftFn;
  onVerifyPin: VerifyPinFn;
}

type ModalState =
  | { type: 'validating' }
  | { type: 'has_errors'; errors: string[] }
  | { type: 'pin_entry' }
  | { type: 'verifying' }
  | { type: 'verified'; employeeId: string; employeeName: string }
  | { type: 'submitting' }
  | { type: 'success' }
  | { type: 'api_error'; message: string };

export function CloseShiftModal({
  open,
  onClose,
  departmentId,
  departmentSlug,
  date,
  shiftType,
  onComplete,
  onCloseShift,
  onVerifyPin,
}: CloseShiftModalProps) {
  const router = useRouter();
  const [state, setState] = useState<ModalState>({ type: 'validating' });
  const [employeeCode, setEmployeeCode] = useState('');
  const [pin, setPin] = useState('');

  const validate = useCallback(async () => {
    setState({ type: 'validating' });
    try {
      const result = await onCloseShift(departmentId, date, shiftType, '', '', true);
      if (result.errors && result.errors.length > 0) {
        setState({ type: 'has_errors', errors: result.errors });
      } else {
        setState({ type: 'pin_entry' });
      }
    } catch (err) {
      setState({
        type: 'api_error',
        message: err instanceof Error ? err.message : 'Validation failed',
      });
    }
  }, [departmentId, date, shiftType, onCloseShift]);

  useEffect(() => {
    if (open) {
      setEmployeeCode('');
      setPin('');
      validate();
    }
  }, [open, validate]);

  const handleVerify = async () => {
    if (!employeeCode || !pin) return;
    setState({ type: 'verifying' });
    try {
      const result = await onVerifyPin(employeeCode, pin);
      if (result.valid && result.employee) {
        setState({
          type: 'verified',
          employeeId: result.employee.id,
          employeeName: result.employee.full_name,
        });
      } else {
        setState({
          type: 'api_error',
          message: result.message || 'Invalid employee code or PIN',
        });
      }
    } catch (err) {
      setState({
        type: 'api_error',
        message: err instanceof Error ? err.message : 'Verification failed',
      });
    }
  };

  const handleCloseShift = async () => {
    if (state.type !== 'verified') return;
    setState({ type: 'submitting' });
    try {
      const result = await onCloseShift(
        departmentId,
        date,
        shiftType,
        state.employeeId,
        pin,
        false,
        departmentSlug
      );
      if (result.success) {
        setState({ type: 'success' });
        router.refresh();
        setTimeout(() => {
          onComplete();
          onClose();
        }, 2000);
      } else {
        setState({
          type: 'api_error',
          message: result.errors?.join(', ') || 'Failed to close shift',
        });
      }
    } catch (err) {
      setState({
        type: 'api_error',
        message: err instanceof Error ? err.message : 'Failed to close shift',
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <GlassCard className="mx-4 w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-heading)] text-lg">Close Shift</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-heading)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {state.type === 'validating' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-blue)]" />
            <p className="text-[var(--text-muted)] text-sm">Validating shift data...</p>
          </div>
        )}

        {state.type === 'has_errors' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-accent-red/20 bg-accent-red/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" />
              <div>
                <p className="mb-2 font-medium text-accent-red text-sm">
                  Cannot close shift until the following are resolved:
                </p>
                <ul className="space-y-1">
                  {state.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-2 text-accent-red/80 text-xs">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-red" />
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-2.5 font-medium text-[var(--text-heading)] text-sm transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              Close
            </button>
          </div>
        )}

        {(state.type === 'pin_entry' || state.type === 'verifying') && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg border border-accent-green/20 bg-accent-green/10 p-3">
              <CheckCircle className="h-5 w-5 shrink-0 text-accent-green" />
              <p className="text-accent-green text-sm">
                All machines accounted for. Supervisor PIN required to close.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[var(--text-secondary)] text-sm">Employee Code</label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="e.g. EMP001"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[var(--text-secondary)] text-sm">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter supervisor PIN"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
              />
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={state.type === 'verifying' || !employeeCode || !pin}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-blue)] py-2.5 font-medium text-[var(--bg-secondary)] transition-colors hover:bg-[var(--accent-blue)]/90 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)]"
            >
              {state.type === 'verifying' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Verify PIN
                </>
              )}
            </button>
          </div>
        )}

        {state.type === 'verified' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg border border-accent-green/20 bg-accent-green/10 p-3">
              <UserCheck className="h-5 w-5 shrink-0 text-accent-green" />
              <div>
                <p className="font-medium text-accent-green text-sm">Approved by</p>
                <p className="text-accent-green text-sm">{state.employeeName}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseShift}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-blue)] py-2.5 font-medium text-[var(--bg-secondary)] transition-colors hover:bg-[var(--accent-blue)]/90"
            >
              <Lock className="h-4 w-4" />
              Close Shift & Lock
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-2 font-medium text-[var(--text-muted)] text-sm transition-colors hover:text-[var(--text-heading)]"
            >
              Cancel
            </button>
          </div>
        )}

        {state.type === 'submitting' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-blue)]" />
            <p className="text-[var(--text-muted)] text-sm">Closing shift...</p>
          </div>
        )}

        {state.type === 'success' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="h-12 w-12 text-accent-green" />
            <p className="font-medium text-accent-green text-lg">Shift closed successfully</p>
          </div>
        )}

        {state.type === 'api_error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-accent-red/20 bg-accent-red/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" />
              <p className="text-accent-red/80 text-sm">{state.message}</p>
            </div>
            <button
              type="button"
              onClick={validate}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-2.5 font-medium text-[var(--text-heading)] text-sm transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              Try Again
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
