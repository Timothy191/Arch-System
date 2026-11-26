'use client';

import type { AssistDataChannelMessage } from '@repo/contract';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import {
  Activity,
  Eraser,
  Maximize2,
  MessageSquare,
  MonitorCog,
  MousePointerClick,
  PenTool,
  PhoneOff,
  Pointer,
  Send,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { endRemoteSupportSession } from '../actions';
import { useWebRtcPeer } from '../hooks/useWebRtcPeer';
import type { SupportDeviceView, SupportSessionView } from '../types/remote-support-ui';

type InteractionTool = 'pointer' | 'draw' | 'cobrowse';

interface ChatMessageItem {
  readonly id: string;
  readonly senderName: string;
  readonly senderRole: 'requester' | 'agent';
  readonly text: string;
  readonly sentAt: string;
}

export interface Tier1SupportViewerProps {
  readonly session: SupportSessionView;
  readonly agentEmployeeId: string;
  readonly agentName: string;
  readonly managedDevices: readonly SupportDeviceView[];
  readonly onSessionClosed: () => void;
  readonly onEscalateTier2: (device: SupportDeviceView) => void;
}

export function Tier1SupportViewer({
  session,
  agentEmployeeId,
  agentName,
  managedDevices,
  onSessionClosed,
  onEscalateTier2,
}: Tier1SupportViewerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);

  const [tool, setTool] = useState<InteractionTool>('pointer');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<readonly ChatMessageItem[]>([]);
  const [cobrowseActive, setCobrowseActive] = useState(session.cobrowse_enabled);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveBox, setShowResolveBox] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown>>(
    (session.client_diagnostics as Record<string, unknown>) ?? {}
  );

  const handleDataMessage = useCallback((message: AssistDataChannelMessage) => {
    if (message.type === 'cobrowse_decision') {
      setCobrowseActive(message.enabled);
      toast.info(
        message.enabled ? 'User granted Portal Co-Browsing' : 'User revoked Portal Co-Browsing'
      );
      return;
    }
    if (message.type === 'chat_message') {
      setChatMessages((prev) => [...prev.slice(-49), message]);
      return;
    }
    if (message.type === 'diagnostics_snapshot') {
      setDiagnostics(message.diagnostics as Record<string, unknown>);
    }
  }, []);

  const peer = useWebRtcPeer({
    sessionId: session.id,
    role: 'agent',
    senderId: agentEmployeeId,
    enabled: session.status === 'active' || session.status === 'consent_requested',
    onDataMessage: handleDataMessage,
    onRemoteSessionEnded: () => {
      toast.info('Employee ended the remote session');
      onSessionClosed();
    },
  });

  useEffect(() => {
    if (videoRef.current && peer.remoteStream) {
      videoRef.current.srcObject = peer.remoteStream;
    }
  }, [peer.remoteStream]);

  const normalizeStagePoint = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const handleStageMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (peer.peerState.phase !== 'connected') return;
    const point = normalizeStagePoint(event.clientX, event.clientY);
    if (!point) return;

    if (tool === 'pointer') {
      peer.sendDataMessage({ type: 'pointer_move', x: point.x, y: point.y });
      return;
    }

    if (tool === 'draw' && isDrawing) {
      currentStrokeRef.current.push(point);
    }
  };

  const handleStageMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (peer.peerState.phase !== 'connected') return;
    const point = normalizeStagePoint(event.clientX, event.clientY);
    if (!point) return;

    if (tool === 'draw') {
      setIsDrawing(true);
      currentStrokeRef.current = [point];
      return;
    }

    if (tool === 'cobrowse' && cobrowseActive) {
      peer.sendDataMessage({
        type: 'cobrowse_action',
        action: { kind: 'click', x: point.x, y: point.y },
      });
      return;
    }

    peer.sendDataMessage({ type: 'pointer_click', x: point.x, y: point.y });
  };

  const handleStageMouseUp = () => {
    if (peer.peerState.phase !== 'connected') return;
    if (tool !== 'draw' || !isDrawing) return;
    setIsDrawing(false);
    const points = currentStrokeRef.current.slice(0, 180);
    currentStrokeRef.current = [];
    if (points.length > 0) {
      peer.sendDataMessage({
        type: 'annotation_stroke',
        id: `stroke-${Date.now()}`,
        color: 'red',
        points,
      });
    }
  };

  const handleRequestCobrowse = () => {
    const sent = peer.sendDataMessage({
      type: 'cobrowse_request',
      agentName,
    });
    if (sent) {
      toast.info('Requested portal co-browse consent from employee');
    } else {
      toast.error('Data channel not ready yet');
    }
  };

  const handleSendChat = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const item: ChatMessageItem = {
      id: `msg-${Date.now()}`,
      senderName: agentName,
      senderRole: 'agent',
      text: trimmed,
      sentAt: new Date().toISOString(),
    };
    peer.sendDataMessage({ type: 'chat_message', ...item });
    setChatMessages((prev) => [...prev.slice(-49), item]);
    setChatInput('');
  };

  const handleCloseSession = async () => {
    setIsClosing(true);
    try {
      await peer.disconnect('Resolved by support agent');
      await endRemoteSupportSession({
        sessionId: session.id,
        resolutionNotes: resolutionNotes.trim() || undefined,
        endReason: 'Resolved by support desk',
      });
      toast.success('Support session closed & audited');
      onSessionClosed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close support session');
    } finally {
      setIsClosing(false);
    }
  };

  const handleToggleFullscreen = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void stageRef.current.requestFullscreen?.().catch(() => undefined);
    }
  };

  const matchedDevice =
    managedDevices.find((d) => d.assigned_employee_id === session.requester_employee_id) ?? null;

  return (
    <GlassCard className="flex flex-col gap-3 p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-black/[0.06] border-b pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-[var(--text-heading)] text-xs">
              #{session.session_code}
            </span>
            <span className="rounded-full bg-[var(--accent-blue)]/12 px-2 py-0.5 font-mono text-[10px] text-[var(--accent-blue)] uppercase">
              {session.status}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
              <Activity className="h-3 w-3" />
              {peer.telemetry.rttMs !== null ? `${peer.telemetry.rttMs}ms` : peer.peerState.phase}
              {peer.telemetry.fps !== null ? ` · ${peer.telemetry.fps}fps` : ''}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[var(--text-muted)] text-xs">
            {session.issue_summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('pointer')}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs',
              tool === 'pointer'
                ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]'
                : 'border-black/10 bg-black/[0.03] text-[var(--text-secondary)]'
            )}
          >
            <Pointer className="h-3.5 w-3.5" />
            <span>Pointer</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('draw')}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs',
              tool === 'draw'
                ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]'
                : 'border-black/10 bg-black/[0.03] text-[var(--text-secondary)]'
            )}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>Annotate</span>
          </button>

          <button
            type="button"
            onClick={() => peer.sendDataMessage({ type: 'annotation_clear' })}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 text-[var(--text-secondary)] text-xs"
          >
            <Eraser className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (cobrowseActive) {
                setTool('cobrowse');
              } else {
                handleRequestCobrowse();
              }
            }}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs',
              cobrowseActive
                ? 'border-[var(--accent-green)] bg-[var(--accent-green)]/12 text-[var(--accent-green)]'
                : 'border-black/10 bg-black/[0.03] text-[var(--text-secondary)]'
            )}
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>{cobrowseActive ? 'Co-Browse Active' : 'Request Co-Browse'}</span>
          </button>

          {matchedDevice && (
            <button
              type="button"
              onClick={() => onEscalateTier2(matchedDevice)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 font-medium text-amber-800 text-xs"
            >
              <MonitorCog className="h-3.5 w-3.5" />
              <span>Escalate OS Control</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSideDrawer((prev) => !prev)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 text-[var(--text-secondary)] text-xs"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Diagnostics</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label="Toggle fullscreen viewer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] text-[var(--text-secondary)]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowResolveBox((prev) => !prev)}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent-red)] px-3 font-semibold text-white text-xs"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>End</span>
          </button>
        </div>
      </div>

      {/* Resolution Drawer */}
      {showResolveBox && (
        <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-black/[0.02] p-3">
          <label
            htmlFor="support-resolution-notes"
            className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase"
          >
            Resolution Notes (Audited)
          </label>
          <textarea
            id="support-resolution-notes"
            rows={2}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Summarize root cause & resolution steps…"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowResolveBox(false)}
              className="h-8 rounded-lg bg-black/[0.05] px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isClosing}
              onClick={handleCloseSession}
              className="h-8 rounded-lg bg-[var(--accent-red)] px-3 font-semibold text-white text-xs"
            >
              {isClosing ? 'Closing…' : 'Confirm Close Session'}
            </button>
          </div>
        </div>
      )}

      {/* Video Stage + Optional Diagnostics Drawer */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div
          ref={stageRef}
          onMouseMove={handleStageMouseMove}
          onMouseDown={handleStageMouseDown}
          onMouseUp={handleStageMouseUp}
          className={cn(
            'relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-black/90',
            showSideDrawer ? 'lg:col-span-8' : 'lg:col-span-12'
          )}
        >
          {peer.remoteStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[70vh] w-full object-contain"
            />
          ) : (
            <div className="p-6 text-center text-white/80 text-xs">
              <p className="font-semibold text-sm">
                {session.status === 'consent_requested'
                  ? 'Waiting for employee to approve screen sharing…'
                  : 'Connecting encrypted WebRTC stream…'}
              </p>
              <p className="mt-1 text-white/60">
                Signaling: {peer.signalingStatus} · Peer: {peer.peerState.phase}
              </p>
            </div>
          )}
        </div>

        {showSideDrawer && (
          <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 lg:col-span-4">
            <div>
              <h4 className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                Client Diagnostics
              </h4>
              <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg bg-white p-2 font-mono text-[10px] text-[var(--text-secondary)]">
                {JSON.stringify(diagnostics, null, 2)}
              </pre>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                <h4 className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase">
                  Session Chat
                </h4>
              </div>
              <div className="max-h-44 flex-1 space-y-1.5 overflow-auto rounded-lg bg-white p-2 text-xs">
                {chatMessages.length === 0 ? (
                  <p className="text-[var(--text-muted)]">No messages yet.</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="rounded bg-black/[0.03] px-2 py-1">
                      <span className="font-semibold text-[var(--text-heading)]">
                        {msg.senderName}:{' '}
                      </span>
                      <span className="text-[var(--text-secondary)]">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send message to user…"
                  className="h-8 flex-1 rounded-lg border border-black/10 bg-white px-2.5 text-xs"
                />
                <button
                  type="submit"
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--accent-blue)] px-2.5 text-white"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
