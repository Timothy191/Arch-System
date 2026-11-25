'use client';

import type { AssistDataChannelMessage } from '@repo/contract';
import { useSupabaseRealtime } from '@repo/shared/hooks';
import type { RemoteSupportSessionsRow } from '@repo/supabase';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import {
  Check,
  Copy,
  Monitor,
  MousePointerClick,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  endRemoteSupportSession,
  respondToRemoteSupportConsent,
  updateCobrowseConsent,
} from '../actions';
import { useRemoteSupportStore } from '../hooks/useRemoteSupportStore';
import { useWebRtcPeer } from '../hooks/useWebRtcPeer';
import { applySensitiveRedaction, executeCoBrowseAction } from '../lib/cobrowse-guard';
import { captureClientDiagnostics } from '../lib/diagnostics';

interface AnnotationStroke {
  readonly id: string;
  readonly color: 'gold' | 'blue' | 'red';
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

const STROKE_COLOR_CLASS: Readonly<Record<'gold' | 'blue' | 'red', string>> = {
  gold: 'stroke-amber-500',
  blue: 'stroke-[var(--accent-blue)]',
  red: 'stroke-[var(--accent-red)]',
};

const COUNTDOWN_INTERVAL_MS = 1000;

function formatRemainingCountdown(expiresAtIso: string, nowMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((new Date(expiresAtIso).getTime() - nowMs) / 1000));
  const mins = Math.floor(diffSeconds / 60);
  const secs = diffSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function RemoteSupportSessionOverlay() {
  const router = useRouter();
  const activeSession = useRemoteSupportStore((s) => s.activeSession);
  const setActiveSession = useRemoteSupportStore((s) => s.setActiveSession);
  const patchActiveSession = useRemoteSupportStore((s) => s.patchActiveSession);
  const clearActiveSession = useRemoteSupportStore((s) => s.clearActiveSession);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isBusy, setIsBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [strokes, setStrokes] = useState<readonly AnnotationStroke[]>([]);

  const supabaseClient = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  // Resolve current employee ID for realtime consent notifications
  useEffect(() => {
    if (!supabaseClient) return;
    let isMounted = true;
    void supabaseClient.auth
      .getUser()
      .then(async ({ data }) => {
        if (!isMounted || !data.user?.id) return;
        const { data: employeeRow } = await supabaseClient
          .from('employees')
          .select('id')
          .eq('auth_id', data.user.id)
          .maybeSingle();
        if (isMounted && employeeRow && typeof employeeRow.id === 'string') {
          setEmployeeId(employeeRow.id);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [supabaseClient]);

  const handleDataMessage = useCallback(
    (message: AssistDataChannelMessage) => {
      if (message.type === 'pointer_move' || message.type === 'pointer_click') {
        setPointerPos({ x: message.x, y: message.y });
        return;
      }
      if (message.type === 'annotation_stroke') {
        setStrokes((prev) => [
          ...prev.slice(-19),
          { id: message.id, color: message.color, points: message.points },
        ]);
        return;
      }
      if (message.type === 'annotation_clear') {
        setStrokes([]);
        setPointerPos(null);
        return;
      }
      if (message.type === 'cobrowse_request') {
        patchActiveSession({
          cobrowsePendingRequest: true,
          agentName: message.agentName,
        });
        return;
      }
      if (message.type === 'cobrowse_action') {
        executeCoBrowseAction({
          action: message.action,
          isCobrowseEnabled: Boolean(activeSession?.cobrowseEnabled),
          onNavigate: (path) => router.push(path),
        });
      }
    },
    [activeSession?.cobrowseEnabled, patchActiveSession, router]
  );

  const handleTerminateSession = useCallback(
    async (isRevoked = false, reason = 'Ended by user') => {
      const current = useRemoteSupportStore.getState().activeSession;
      applySensitiveRedaction(false);
      setStrokes([]);
      setPointerPos(null);
      clearActiveSession();

      if (current?.sessionId) {
        await endRemoteSupportSession({
          sessionId: current.sessionId,
          isRevoked,
          endReason: reason,
        }).catch(() => undefined);
      }
    },
    [clearActiveSession]
  );

  const peer = useWebRtcPeer({
    sessionId: activeSession?.sessionId ?? null,
    role: 'requester',
    senderId: employeeId,
    enabled: Boolean(activeSession && activeSession.tier === 'tier1_browser'),
    onDataMessage: handleDataMessage,
    onStreamEnded: () => {
      void handleTerminateSession(true, 'Browser screen share stopped');
    },
    onRemoteSessionEnded: () => {
      applySensitiveRedaction(false);
      setStrokes([]);
      setPointerPos(null);
      clearActiveSession();
      toast.info('Remote support session ended by support desk');
    },
  });

  // Listen for session status updates & incoming Tier 2 consent requests
  useSupabaseRealtime<RemoteSupportSessionsRow>({
    supabaseClient,
    table: 'remote_support_sessions',
    filter: employeeId ? `requester_employee_id=eq.${employeeId}` : undefined,
    enabled: Boolean(supabaseClient && employeeId),
    onChange: (payload) => {
      const record = payload.new;
      if (!record?.id) return;

      if (
        record.status === 'ended' ||
        record.status === 'rejected' ||
        record.status === 'expired' ||
        record.status === 'revoked'
      ) {
        if (activeSession?.sessionId === record.id) {
          applySensitiveRedaction(false);
          void peer.disconnect(record.end_reason ?? undefined);
          clearActiveSession();
          toast.info('Remote support session closed');
        }
        return;
      }

      if (
        record.status === 'consent_requested' ||
        record.status === 'pending' ||
        record.status === 'active'
      ) {
        setActiveSession({
          sessionId: record.id,
          sessionCode: record.session_code,
          tier: record.tier,
          status: record.status,
          issueSummary: record.issue_summary,
          agentName: activeSession?.agentName ?? 'Support Engineer',
          agentRole: activeSession?.agentRole ?? 'supervisor',
          deviceName: activeSession?.deviceName ?? null,
          cobrowseEnabled: record.cobrowse_enabled,
          cobrowsePendingRequest: activeSession?.cobrowsePendingRequest ?? false,
          expiresAt: record.expires_at,
        });
      }
    },
  });

  // Apply redaction blur when co-browsing is enabled
  useEffect(() => {
    applySensitiveRedaction(Boolean(activeSession?.cobrowseEnabled));
    return () => {
      applySensitiveRedaction(false);
    };
  }, [activeSession?.cobrowseEnabled]);

  // Countdown tick for pending 6-digit code
  useEffect(() => {
    if (typeof window === 'undefined' || activeSession?.status !== 'pending') return;
    const timer = window.setInterval(() => setNowMs(Date.now()), COUNTDOWN_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeSession?.status]);

  // Global Shift+Esc emergency kill switch
  useEffect(() => {
    if (typeof window === 'undefined' || !activeSession) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'Escape') {
        event.preventDefault();
        void peer.disconnect('Shift+Esc kill switch');
        void handleTerminateSession(true, 'Shift+Esc emergency kill switch');
        toast.warning('Remote support terminated immediately');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSession, handleTerminateSession, peer]);

  // Send sanitized diagnostics once DataChannel opens
  useEffect(() => {
    if (peer.peerState.phase === 'connected') {
      peer.sendDataMessage({
        type: 'diagnostics_snapshot',
        diagnostics: captureClientDiagnostics(0),
      });
    }
  }, [peer]);

  if (!activeSession) {
    return null;
  }

  const handleCopyCode = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(activeSession.sessionCode).catch(() => undefined);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleApproveConsent = async () => {
    setIsBusy(true);
    try {
      if (activeSession.tier === 'tier1_browser') {
        await peer.startScreenShare();
      }
      await respondToRemoteSupportConsent({
        sessionId: activeSession.sessionId,
        approved: true,
      });
      patchActiveSession({ status: 'active' });
      toast.success('Remote assistance session active');
    } catch {
      await respondToRemoteSupportConsent({
        sessionId: activeSession.sessionId,
        approved: false,
        rejectionReason: 'Screen share cancelled by user',
      }).catch(() => undefined);
      clearActiveSession();
      toast.error('Screen share was cancelled');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeclineConsent = async () => {
    setIsBusy(true);
    try {
      await respondToRemoteSupportConsent({
        sessionId: activeSession.sessionId,
        approved: false,
        rejectionReason: 'Declined in consent modal',
      });
      clearActiveSession();
      toast.info('Remote support request declined');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCobrowseDecision = async (enabled: boolean) => {
    setIsBusy(true);
    try {
      await updateCobrowseConsent({
        sessionId: activeSession.sessionId,
        enabled,
      });
      patchActiveSession({
        cobrowseEnabled: enabled,
        cobrowsePendingRequest: false,
      });
      peer.sendDataMessage({ type: 'cobrowse_decision', enabled });
      toast.info(enabled ? 'Portal control enabled' : 'Portal control revoked');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div data-remote-support-overlay="true">
      {/* Live Non-Blocking Laser Pointer & Annotation SVG Layer */}
      {activeSession.status === 'active' && (pointerPos || strokes.length > 0) && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {strokes.map((stroke) => (
              <polyline
                key={stroke.id}
                fill="none"
                strokeWidth="0.45"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={STROKE_COLOR_CLASS[stroke.color]}
                points={stroke.points.map((pt) => `${pt.x * 100},${pt.y * 100}`).join(' ')}
              />
            ))}
          </svg>
          {pointerPos && (
            <span
              style={{
                left: `${pointerPos.x * 100}%`,
                top: `${pointerPos.y * 100}%`,
              }}
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent-red)] shadow-md"
            />
          )}
        </div>
      )}

      {/* Pending 6-Digit Code Card */}
      {activeSession.status === 'pending' && (
        <div className="fixed right-4 bottom-16 z-popover w-80">
          <GlassCard variant="window" className="p-4 shadow-window">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  Remote Support Code
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-bold font-mono text-2xl text-[var(--text-heading)] tracking-[0.22em]">
                    {activeSession.sessionCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    aria-label="Copy support code"
                    className="rounded-lg border border-black/10 bg-black/[0.04] p-1.5 text-[var(--text-secondary)] hover:bg-black/[0.08]"
                  >
                    {copiedCode ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleTerminateSession(false, 'Cancelled before claim')}
                aria-label="Cancel support request"
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[var(--text-secondary)] text-xs">
              Share this 6-digit code with Support. Expires in{' '}
              <span className="font-mono font-semibold">
                {formatRemainingCountdown(activeSession.expiresAt, nowMs)}
              </span>
              .
            </p>
          </GlassCard>
        </div>
      )}

      {/* Explicit Consent Modal (Tier 1 or Tier 2) */}
      {activeSession.status === 'consent_requested' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Remote Support Consent"
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs"
        >
          <GlassCard variant="window" className="w-full max-w-md p-5 shadow-window">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-[var(--text-heading)] text-sm">
                  Approve Remote Assistance?
                </h2>
                <p className="text-[var(--text-muted)] text-xs">
                  {activeSession.agentName ?? 'Support Engineer'} (
                  {activeSession.agentRole ?? 'staff'})
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-black/[0.07] bg-black/[0.03] p-3 text-xs">
              <p className="font-medium text-[var(--text-heading)]">
                {activeSession.tier === 'tier2_os_desktop'
                  ? `Tier 2: Full OS Desktop Control (${activeSession.deviceName ?? 'Workstation'})`
                  : 'Tier 1: Browser Screen Share (View & Annotations)'}
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">
                You can end the session instantly at any time with Shift+Esc.
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleDeclineConsent}
                className="h-9 rounded-lg border border-black/10 bg-black/[0.04] px-3.5 font-medium text-[var(--text-secondary)] text-xs hover:bg-black/[0.08]"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleApproveConsent}
                className="h-9 rounded-lg bg-[var(--accent-blue)] px-4 font-semibold text-white text-xs hover:opacity-90 disabled:opacity-50"
              >
                {isBusy
                  ? 'Starting…'
                  : activeSession.tier === 'tier2_os_desktop'
                    ? 'Approve OS Control'
                    : 'Approve Screen Share'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Secondary Co-Browse Escalation Prompt */}
      {activeSession.status === 'active' &&
        activeSession.cobrowsePendingRequest &&
        !activeSession.cobrowseEnabled && (
          <div className="fixed right-4 bottom-16 z-popover w-80">
            <GlassCard variant="window" className="p-4 shadow-window">
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-[var(--accent-blue)]" />
                <h3 className="font-semibold text-[var(--text-heading)] text-xs">
                  Allow Portal Co-Browsing?
                </h3>
              </div>
              <p className="mt-1.5 text-[var(--text-secondary)] text-xs">
                Support wants to click and type inside this portal tab. Password fields stay masked.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleCobrowseDecision(false)}
                  className="h-8 rounded-lg bg-black/[0.05] px-3 font-medium text-[var(--text-secondary)] text-xs"
                >
                  Deny
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleCobrowseDecision(true)}
                  className="h-8 rounded-lg bg-[var(--accent-blue)] px-3 font-semibold text-white text-xs"
                >
                  Allow Control
                </button>
              </div>
            </GlassCard>
          </div>
        )}

      {/* Always-On Top-Center Kill Switch Bar */}
      {activeSession.status === 'active' && (
        <div className="fixed top-12 left-1/2 z-popover -translate-x-1/2">
          <div
            className={cn(
              'liquid-glass-light flex items-center gap-2.5 rounded-full border border-black/10',
              'bg-white/95 px-3.5 py-1.5 shadow-window backdrop-blur-xl'
            )}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-green)]" />
            <Monitor className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            <span className="font-medium text-[var(--text-heading)] text-xs">
              {activeSession.cobrowseEnabled ? 'Portal Control Active' : 'Screen Shared'}
            </span>

            {activeSession.cobrowseEnabled && (
              <button
                type="button"
                onClick={() => void handleCobrowseDecision(false)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-800 text-xs hover:bg-amber-500/25"
              >
                <ShieldCheck className="h-3 w-3" />
                Revoke Control
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                void peer.disconnect('Ended via kill bar');
                void handleTerminateSession(true, 'Kill bar clicked');
              }}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-red)] px-2.5 py-0.5 font-semibold text-white text-xs hover:opacity-90"
            >
              <PhoneOff className="h-3 w-3" />
              End (Shift+Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
