'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import type { RemoteSupportAuditEventsRow, RemoteSupportSessionsRow } from '@repo/supabase';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import {
  Headphones,
  History,
  KeyRound,
  Laptop,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  claimRemoteSupportSession,
  endRemoteSupportSession,
  initiateTier2ConsentSession,
  listRemoteSupportAuditEvents,
} from '../actions';
import type {
  SupportAuditEventView,
  SupportDeviceView,
  SupportSessionView,
} from '../types/remote-support-ui';
import { ManagedDevicesPanel } from './ManagedDevicesPanel';
import { SupportAuditLogPanel } from './SupportAuditLogPanel';
import { Tier1SupportViewer } from './Tier1SupportViewer';
import { Tier2DesktopViewer } from './Tier2DesktopViewer';

export interface RemoteSupportDeskProps {
  readonly agentEmployeeId: string;
  readonly agentName: string;
  readonly userRole: string;
  readonly initialSessions: readonly SupportSessionView[];
  readonly initialDevices: readonly SupportDeviceView[];
  readonly initialAuditEvents: readonly SupportAuditEventView[];
  readonly schemaReady: boolean;
}

type DeskTab = 'live' | 'devices' | 'audit';

export function RemoteSupportDesk({
  agentEmployeeId,
  agentName,
  userRole,
  initialSessions,
  initialDevices,
  initialAuditEvents,
  schemaReady,
}: RemoteSupportDeskProps) {
  const [activeTab, setActiveTab] = useState<DeskTab>('live');
  const [sessions, setSessions] = useState<readonly SupportSessionView[]>(initialSessions);
  const [devices, setDevices] = useState<readonly SupportDeviceView[]>(initialDevices);
  const [auditEvents, setAuditEvents] =
    useState<readonly SupportAuditEventView[]>(initialAuditEvents);
  const [refreshingAudit, setRefreshingAudit] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessions[0]?.id ?? null
  );
  const [claimCode, setClaimCode] = useState('');
  const [claiming, setClaiming] = useState(false);

  const supabaseClient = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useSupabaseRealtime<RemoteSupportSessionsRow>({
    supabaseClient,
    table: 'remote_support_sessions',
    enabled: Boolean(supabaseClient && schemaReady),
    onChange: (payload) => {
      const record = payload.new;
      if (!record?.id) return;
      setSessions((prev) => {
        const exists = prev.some((item) => item.id === record.id);
        if (exists) {
          return prev.map((item) => (item.id === record.id ? { ...item, ...record } : item));
        }
        return [record, ...prev];
      });
    },
  });

  useSupabaseRealtime<RemoteSupportAuditEventsRow>({
    supabaseClient,
    table: 'remote_support_audit_events',
    enabled: Boolean(supabaseClient && schemaReady),
    onChange: (payload) => {
      const record = payload.new;
      if (!record?.id) return;
      setAuditEvents((prev) => {
        const exists = prev.some((item) => item.id === record.id);
        if (exists) {
          return prev.map((item) => (item.id === record.id ? { ...item, ...record } : item));
        }
        return [record, ...prev];
      });
    },
  });

  const handleRefreshAuditEvents = useCallback(async () => {
    setRefreshingAudit(true);
    try {
      const res = await listRemoteSupportAuditEvents();
      setAuditEvents(res.events);
      toast.success('Audit trail refreshed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to refresh audit trail');
    } finally {
      setRefreshingAudit(false);
    }
  }, []);

  const openSessions = sessions.filter(
    (s) =>
      s.status === 'pending' ||
      s.status === 'claimed' ||
      s.status === 'consent_requested' ||
      s.status === 'active'
  );
  const selectedSession =
    openSessions.find((s) => s.id === selectedSessionId) ?? openSessions[0] ?? null;

  const upsertLocalSession = (updated: RemoteSupportSessionsRow) => {
    setSessions((prev) => {
      const exists = prev.some((item) => item.id === updated.id);
      if (exists) {
        return prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item));
      }
      return [updated, ...prev];
    });
    setSelectedSessionId(updated.id);
  };

  const handleClaimByCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = claimCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      toast.error('Enter a valid 6-digit support code');
      return;
    }
    setClaiming(true);
    try {
      const result = await claimRemoteSupportSession({ sessionCode: trimmed });
      upsertLocalSession(result.session);
      setClaimCode('');
      setActiveTab('live');
      toast.success(`Consent request sent for code ${trimmed}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to claim code');
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimRow = async (session: SupportSessionView) => {
    setClaiming(true);
    try {
      const result = await claimRemoteSupportSession({ sessionId: session.id });
      upsertLocalSession(result.session);
      toast.success(`Claimed #${session.session_code} — awaiting employee approval`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to claim session');
    } finally {
      setClaiming(false);
    }
  };

  const handleConnectTier2Device = async (device: SupportDeviceView) => {
    try {
      const justificationReason = device.require_user_consent
        ? undefined
        : 'Authorized admin maintenance session';
      const result = await initiateTier2ConsentSession({
        deviceId: device.id,
        issueSummary: `Tier 2 OS desktop assistance on ${device.hostname}`,
        justificationReason,
      });
      upsertLocalSession(result.session);
      setActiveTab('live');
      toast.success(
        device.require_user_consent
          ? `Sent Tier 2 consent request for ${device.hostname}`
          : `Connected unattended Tier 2 session on ${device.hostname}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to initiate Tier 2 session');
    }
  };

  const handleCloseDeactivatedTier2Session = async (session: SupportSessionView) => {
    await endRemoteSupportSession({
      sessionId: session.id,
      endReason: 'Target Tier 2 workstation deactivated',
    }).catch(() => undefined);
    setSessions((prev) => prev.filter((item) => item.id !== session.id));
    toast.info('Closed session for deactivated workstation');
  };

  const selectedTier2Device =
    selectedSession?.tier === 'tier2_os_desktop'
      ? (devices.find((d) => d.id === selectedSession.device_id && d.is_active) ?? null)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-lg">
      {!schemaReady && (
        <GlassCard className="border-accent-amber/35 bg-accent-amber/10 p-4 text-[var(--text-heading)] text-xs">
          Remote Support database tables (`remote_support_sessions`, `remote_support_devices`,
          `remote_support_audit_events`) are pending migration `230_remote_support_system.sql` on
          the target Supabase instance.
        </GlassCard>
      )}

      {/* Header + 6-Digit Claim Bar */}
      <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]">
            <Headphones className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-semibold text-[var(--text-heading)] text-base">
              Arch Support Desk — Hybrid Remote Assistance
            </h1>
            <p className="text-[var(--text-muted)] text-xs">
              Tier 1 Zero-Download WebRTC Assist · Tier 2 Encrypted OS Desktop Gateway
            </p>
          </div>
        </div>

        <form onSubmit={handleClaimByCode} className="flex items-center gap-2">
          <div className="relative">
            <KeyRound className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              aria-label="Enter 6-digit support code"
              className="h-9 w-36 rounded-lg border border-black/10 bg-[var(--bg-primary)] pr-3 pl-8 font-mono text-xs tracking-widest"
            />
          </div>
          <button
            type="submit"
            disabled={claiming || claimCode.length !== 6}
            className="h-9 rounded-lg bg-[var(--accent-blue)] px-4 font-semibold text-white text-xs disabled:opacity-45"
          >
            {claiming ? 'Claiming…' : 'Claim Session'}
          </button>
        </form>
      </GlassCard>

      {/* Sub-Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('live')}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-medium text-xs',
            activeTab === 'live'
              ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]'
              : 'border-black/10 bg-[var(--bg-primary)]/80 text-[var(--text-secondary)]'
          )}
        >
          <MonitorUp className="h-3.5 w-3.5" />
          <span>Live Desk ({openSessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('devices')}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-medium text-xs',
            activeTab === 'devices'
              ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]'
              : 'border-black/10 bg-[var(--bg-primary)]/80 text-[var(--text-secondary)]'
          )}
        >
          <Laptop className="h-3.5 w-3.5" />
          <span>Managed Workstations ({devices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-medium text-xs',
            activeTab === 'audit'
              ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]'
              : 'border-black/10 bg-[var(--bg-primary)]/80 text-[var(--text-secondary)]'
          )}
        >
          <History className="h-3.5 w-3.5" />
          <span>Audit History ({auditEvents.length})</span>
        </button>
      </div>

      {activeTab === 'live' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Active Support Queue */}
          <GlassCard className="flex flex-col gap-2.5 p-3 lg:col-span-4">
            <div className="flex items-center justify-between border-black/[0.06] border-b pb-2">
              <span className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Active Support Queue
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--accent-green)]">
                <ShieldCheck className="h-3 w-3" />
                Consent Enforced
              </span>
            </div>

            {openSessions.length === 0 ? (
              <p className="py-8 text-center text-[var(--text-muted)] text-xs">
                No active support requests. Ask the user to click Remote Assist or enter a 6-digit
                code above.
              </p>
            ) : (
              openSessions.map((session) => {
                const isSelected = selectedSession?.id === session.id;
                return (
                  <div
                    key={session.id}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-xl border p-3 transition-colors',
                      isSelected
                        ? 'border-[var(--accent-blue)]/45 bg-[var(--accent-blue)]/8'
                        : 'border-black/[0.07] bg-[var(--bg-primary)]/75'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className="font-bold font-mono text-[var(--text-heading)] text-xs hover:underline"
                      >
                        #{session.session_code} ·{' '}
                        {session.tier === 'tier2_os_desktop' ? 'Tier 2' : 'Tier 1'}
                      </button>
                      <span className="rounded-full bg-black/[0.06] px-2 py-0.5 font-mono text-[10px]">
                        {session.status}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-[var(--text-secondary)] text-xs">
                      {session.issue_summary}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {session.department_slug ?? 'portal'}
                      </span>
                      {session.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => void handleClaimRow(session)}
                          className="h-6 rounded-md bg-[var(--accent-blue)] px-2.5 font-semibold text-[11px] text-white"
                        >
                          Claim
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedSessionId(session.id)}
                          className="h-6 rounded-md border border-black/10 bg-[var(--bg-primary)] px-2.5 text-[11px]"
                        >
                          Open Stage
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </GlassCard>

          {/* Active Stage */}
          <div className="lg:col-span-8">
            {!selectedSession ? (
              <GlassCard className="flex min-h-[420px] items-center justify-center p-6 text-center text-[var(--text-muted)] text-xs">
                Select or claim a remote support session to launch the viewer.
              </GlassCard>
            ) : selectedSession.tier === 'tier2_os_desktop' ? (
              selectedTier2Device ? (
                <Tier2DesktopViewer
                  session={selectedSession}
                  device={selectedTier2Device}
                  onSessionClosed={() =>
                    setSessions((prev) => prev.filter((item) => item.id !== selectedSession.id))
                  }
                />
              ) : (
                <GlassCard
                  data-testid="tier2-device-deactivated-state"
                  className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-red)]/12 text-[var(--accent-red)]">
                    <MonitorOff className="h-5 w-5" />
                  </span>
                  <div className="max-w-md space-y-1">
                    <h3 className="font-semibold text-[var(--text-heading)] text-sm">
                      Tier 2 Workstation Unavailable or Deactivated
                    </h3>
                    <p className="text-[var(--text-muted)] text-xs">
                      The managed workstation bound to session #{selectedSession.session_code} was
                      deactivated or removed. Tier 2 OS desktop sessions cannot fall back to browser
                      screen sharing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCloseDeactivatedTier2Session(selectedSession)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-red)] px-3.5 font-semibold text-white text-xs"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    <span>Close Session</span>
                  </button>
                </GlassCard>
              )
            ) : (
              <Tier1SupportViewer
                session={selectedSession}
                agentEmployeeId={agentEmployeeId}
                agentName={agentName}
                managedDevices={devices}
                onEscalateTier2={(device) => void handleConnectTier2Device(device)}
                onSessionClosed={() =>
                  setSessions((prev) => prev.filter((item) => item.id !== selectedSession.id))
                }
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'devices' && (
        <ManagedDevicesPanel
          devices={devices}
          userRole={userRole}
          onDevicesChanged={setDevices}
          onConnectDevice={(device) => void handleConnectTier2Device(device)}
        />
      )}

      {activeTab === 'audit' && (
        <SupportAuditLogPanel
          events={auditEvents}
          isRefreshing={refreshingAudit}
          onRefresh={() => void handleRefreshAuditEvents()}
        />
      )}
    </div>
  );
}
