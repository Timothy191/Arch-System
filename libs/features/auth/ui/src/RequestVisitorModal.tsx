'use client';

import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  KeyRound,
  Loader2,
  QrCode,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

const FOCUS_DELAY_MS = 40;
const COPY_FEEDBACK_MS = 2_000;
const MAX_NAME_CHARS = 100;
const MAX_COMPANY_CHARS = 150;
const MAX_VISITING_CHARS = 150;
const MAX_REASON_CHARS = 300;
const MAX_ID_CHARS = 50;

const MODAL_OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-sm';

const MODAL_CARD_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-500/30 bg-white/95 p-6 shadow-window backdrop-blur-xl';

const INPUT_WRAPPER_CLASS =
  'relative flex items-center overflow-hidden rounded-xl border border-black/[0.08] bg-white transition-all focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20';

const INPUT_CLASS =
  'h-10 w-full rounded-xl bg-transparent pr-3.5 pl-9 text-[13px] text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-0 disabled:opacity-60';

const LABEL_CLASS = 'block font-medium text-[12px] text-zinc-800 leading-4';

const PRIMARY_CTA_CLASS =
  'group gold-steel-border flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 font-semibold text-[13px] text-zinc-950 shadow-card transition-colors hover:bg-amber-400 disabled:opacity-60';

const SECONDARY_CTA_CLASS =
  'flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 font-medium text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60';

export interface IssuedVisitorPass {
  readonly qrCode: string;
  readonly visitorId: string;
  readonly fullName: string;
  readonly company: string;
  readonly visiting: string;
  readonly status: string;
  readonly expiresAt: string;
}

type ModalSubmissionStage =
  | { readonly kind: 'form'; readonly errorMessage: string | null }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'issued'; readonly issuedPass: IssuedVisitorPass };

export interface RequestVisitorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly renderQrCode?: (qrCode: string) => ReactNode;
}

interface VisitorFormDraft {
  readonly firstName: string;
  readonly surname: string;
  readonly company: string;
  readonly visiting: string;
  readonly reasonForEntry: string;
  readonly idNumber: string;
}

const INITIAL_DRAFT: VisitorFormDraft = {
  firstName: '',
  surname: '',
  company: '',
  visiting: '',
  reasonForEntry: '',
  idNumber: '',
};

interface VisitorPassApiResponse {
  readonly success?: boolean;
  readonly error?: string;
  readonly pass?: IssuedVisitorPass;
}

interface IssuedPassCardProps {
  readonly titleId: string;
  readonly descriptionId: string;
  readonly issuedPass: IssuedVisitorPass;
  readonly renderQrCode?: (qrCode: string) => ReactNode;
  readonly onRequestAnother: () => void;
  readonly onDone: () => void;
}

function IssuedPassView({
  titleId,
  descriptionId,
  issuedPass,
  renderQrCode,
  onRequestAnother,
  onDone,
}: IssuedPassCardProps) {
  const [didCopyCode, setDidCopyCode] = useState(false);

  useEffect(() => {
    if (!didCopyCode) {
      return;
    }
    const resetTimer = setTimeout(() => setDidCopyCode(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(resetTimer);
  }, [didCopyCode]);

  async function handleCopyCode() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issuedPass.qrCode);
      setDidCopyCode(true);
      toast.success('Visitor QR reference copied');
    } catch {
      toast.error('Unable to copy code automatically');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-2.5 py-0.5 font-mono font-semibold text-[11px] text-amber-900">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
            <span>{issuedPass.status} · Gate Check-In Required</span>
          </div>
          <h3 id={titleId} className="mt-1.5 font-semibold text-base text-zinc-900">
            Pending Visitor QR Pass Ready
          </h3>
          <p id={descriptionId} className="mt-0.5 text-[13px] text-zinc-600 leading-5">
            Present this QR code to Access Control at the main security gate to complete
            verification and activate turnstile entry.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-50/50 p-4">
        {renderQrCode ? (
          renderQrCode(issuedPass.qrCode)
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-zinc-200 bg-white text-amber-700">
            <QrCode className="h-16 w-16" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="font-bold font-mono text-amber-950 text-xl tracking-wider">
            {issuedPass.qrCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy visitor QR code"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-amber-500/30 bg-white text-zinc-700 transition-colors hover:bg-amber-100/70 hover:text-amber-900"
          >
            {didCopyCode ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div className="w-full space-y-1 border-amber-500/20 border-t pt-2.5 text-center text-[12px] text-zinc-700">
          <p className="font-medium text-zinc-900">
            {issuedPass.fullName} · {issuedPass.company}
          </p>
          <p className="text-zinc-600">Visiting: {issuedPass.visiting}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
        <button type="button" onClick={onRequestAnother} className={SECONDARY_CTA_CLASS}>
          <span>New Request</span>
        </button>
        <button type="button" onClick={onDone} className={PRIMARY_CTA_CLASS}>
          <span>Done</span>
        </button>
      </div>
    </div>
  );
}

export function RequestVisitorModal({ isOpen, onClose, renderQrCode }: RequestVisitorModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<VisitorFormDraft>(INITIAL_DRAFT);
  const [stage, setStage] = useState<ModalSubmissionStage>({
    kind: 'form',
    errorMessage: null,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = setTimeout(() => {
      firstInputRef.current?.focus();
    }, FOCUS_DELAY_MS);

    const handleEscapeKey = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isSubmitting = stage.kind === 'submitting';

  function resetDraftAndStage() {
    setDraft(INITIAL_DRAFT);
    setStage({ kind: 'form', errorMessage: null });
  }

  function handleDismiss() {
    if (isSubmitting) {
      return;
    }
    resetDraftAndStage();
    onClose();
  }

  function updateField<K extends keyof VisitorFormDraft>(fieldKey: K, nextText: string) {
    setDraft((previousDraft) => ({
      ...previousDraft,
      [fieldKey]: nextText,
    }));
    if (stage.kind === 'form' && stage.errorMessage) {
      setStage({ kind: 'form', errorMessage: null });
    }
  }

  async function handleFormSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    formEvent.stopPropagation();

    if (isSubmitting) {
      return;
    }

    const trimmedFirstName = draft.firstName.trim();
    const trimmedSurname = draft.surname.trim();
    const trimmedCompany = draft.company.trim();
    const trimmedVisiting = draft.visiting.trim();
    const trimmedReason = draft.reasonForEntry.trim();
    const trimmedIdNumber = draft.idNumber.trim();

    if (
      !trimmedFirstName ||
      !trimmedSurname ||
      !trimmedCompany ||
      !trimmedVisiting ||
      !trimmedReason
    ) {
      setStage({
        kind: 'form',
        errorMessage: 'Please complete all required visitor pass fields.',
      });
      return;
    }

    setStage({ kind: 'submitting' });

    try {
      const response = await fetch('/api/auth/visitor-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          surname: trimmedSurname,
          company: trimmedCompany,
          visiting: trimmedVisiting,
          reason_for_entry: trimmedReason,
          id_number: trimmedIdNumber.length > 0 ? trimmedIdNumber : null,
        }),
      });

      const responsePayload = (await response.json()) as VisitorPassApiResponse;

      if (!response.ok || !responsePayload.success || !responsePayload.pass) {
        const failureReason =
          responsePayload.error ?? 'Failed to submit visitor request. Please try again.';
        setStage({ kind: 'form', errorMessage: failureReason });
        toast.error(failureReason);
        return;
      }

      setStage({ kind: 'issued', issuedPass: responsePayload.pass });
      toast.success(`Visitor pass ${responsePayload.pass.qrCode} pre-registered`);
    } catch {
      const networkFailureMessage =
        'Network error while requesting visitor pass. Please try again.';
      setStage({ kind: 'form', errorMessage: networkFailureMessage });
      toast.error(networkFailureMessage);
    }
  }

  const dialogMarkup = (
    <div
      role="presentation"
      onClick={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) {
          handleDismiss();
        }
      }}
      className={MODAL_OVERLAY_CLASS}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={MODAL_CARD_CLASS}
      >
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isSubmitting}
          aria-label="Close visitor pass dialog"
          className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {stage.kind === 'issued' ? (
          <IssuedPassView
            titleId={titleId}
            descriptionId={descriptionId}
            issuedPass={stage.issuedPass}
            renderQrCode={renderQrCode}
            onRequestAnother={resetDraftAndStage}
            onDone={handleDismiss}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 pr-8">
              <div className="gold-steel-border gold-steel-border-slim flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-50 text-amber-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 id={titleId} className="font-semibold text-base text-zinc-900">
                  Request Visitor Pass
                </h2>
                <p id={descriptionId} className="mt-0.5 text-[13px] text-zinc-600 leading-5">
                  Pre-register for a visitor QR reference without signing in. Gate security verifies
                  and activates entry on arrival.
                </p>
              </div>
            </div>

            <form
              data-testid="visitor-request-form"
              onSubmit={handleFormSubmit}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="visitor-first-name" className={LABEL_CLASS}>
                    Visitor Name <span className="text-amber-700">*</span>
                  </label>
                  <div className={INPUT_WRAPPER_CLASS}>
                    <User className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
                    <input
                      ref={firstInputRef}
                      id="visitor-first-name"
                      name="first_name"
                      type="text"
                      required
                      maxLength={MAX_NAME_CHARS}
                      disabled={isSubmitting}
                      value={draft.firstName}
                      onChange={(changeEvent) => updateField('firstName', changeEvent.target.value)}
                      placeholder="Sipho"
                      className={INPUT_CLASS}
                      autoComplete="given-name"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="visitor-surname" className={LABEL_CLASS}>
                    Visitor Surname <span className="text-amber-700">*</span>
                  </label>
                  <div className={INPUT_WRAPPER_CLASS}>
                    <User className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
                    <input
                      id="visitor-surname"
                      name="surname"
                      type="text"
                      required
                      maxLength={MAX_NAME_CHARS}
                      disabled={isSubmitting}
                      value={draft.surname}
                      onChange={(changeEvent) => updateField('surname', changeEvent.target.value)}
                      placeholder="Dlamini"
                      className={INPUT_CLASS}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="visitor-company" className={LABEL_CLASS}>
                    Visitor Company <span className="text-amber-700">*</span>
                  </label>
                  <div className={INPUT_WRAPPER_CLASS}>
                    <Building2 className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
                    <input
                      id="visitor-company"
                      name="company"
                      type="text"
                      required
                      maxLength={MAX_COMPANY_CHARS}
                      disabled={isSubmitting}
                      value={draft.company}
                      onChange={(changeEvent) => updateField('company', changeEvent.target.value)}
                      placeholder="Komatsu SA"
                      className={INPUT_CLASS}
                      autoComplete="organization"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="visitor-id-number" className={LABEL_CLASS}>
                    ID / Passport Number{' '}
                    <span className="font-normal text-zinc-500">(Optional)</span>
                  </label>
                  <div className={INPUT_WRAPPER_CLASS}>
                    <CreditCard className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
                    <input
                      id="visitor-id-number"
                      name="id_number"
                      type="text"
                      maxLength={MAX_ID_CHARS}
                      disabled={isSubmitting}
                      value={draft.idNumber}
                      onChange={(changeEvent) => updateField('idNumber', changeEvent.target.value)}
                      placeholder="Optional ID or Passport"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="visitor-visiting" className={LABEL_CLASS}>
                  Person Being Visited <span className="text-amber-700">*</span>
                </label>
                <div className={INPUT_WRAPPER_CLASS}>
                  <Users className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="visitor-visiting"
                    name="visiting"
                    type="text"
                    required
                    maxLength={MAX_VISITING_CHARS}
                    disabled={isSubmitting}
                    value={draft.visiting}
                    onChange={(changeEvent) => updateField('visiting', changeEvent.target.value)}
                    placeholder="e.g. Engineering Workshop / Plant Supervisor"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="visitor-reason" className={LABEL_CLASS}>
                  Reason for Visit <span className="text-amber-700">*</span>
                </label>
                <div className={INPUT_WRAPPER_CLASS}>
                  <FileText className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="visitor-reason"
                    name="reason_for_entry"
                    type="text"
                    required
                    maxLength={MAX_REASON_CHARS}
                    disabled={isSubmitting}
                    value={draft.reasonForEntry}
                    onChange={(changeEvent) =>
                      updateField('reasonForEntry', changeEvent.target.value)
                    }
                    placeholder="e.g. Scheduled equipment inspection, delivery, safety audit"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {stage.kind === 'form' && stage.errorMessage && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
                >
                  {stage.errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isSubmitting}
                  className={SECONDARY_CTA_CLASS}
                >
                  <span>Cancel</span>
                </button>
                <button type="submit" disabled={isSubmitting} className={PRIMARY_CTA_CLASS}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </span>
                  ) : (
                    <>
                      <span>Request Visitor QR</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(dialogMarkup, document.body);
  }

  return dialogMarkup;
}
