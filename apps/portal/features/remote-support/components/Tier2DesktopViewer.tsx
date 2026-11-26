'use client';

import type { Tier2LaunchResponse } from '@repo/contract';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  ClipboardPaste,
  KeyRound,
  Maximize2,
  Monitor,
  PhoneOff,
  Scaling,
  ShieldAlert,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { endRemoteSupportSession } from '../actions';
import type { SupportDeviceView, SupportSessionView } from '../types/remote-support-ui';

const KEYSYM_CTRL_LEFT = 0xffe3;
const KEYSYM_ALT_LEFT = 0xffe9;
const KEYSYM_DELETE = 0xffff;

export interface Tier2DesktopViewerProps {
  readonly session: SupportSessionView;
  readonly device: SupportDeviceView;
  readonly onSessionClosed: () => void;
}

type ViewerStatus = 'credentials' | 'connecting' | 'connected' | 'error';

export function Tier2DesktopViewer({ session, device, onSessionClosed }: Tier2DesktopViewerProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const displayMountRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<{
    disconnect: () => void;
    sendKeyEvent: (pressed: number, keysym: number) => void;
    createClipboardStream: (mimetype: string) => {
      sendBlob: (chunkBase64: string) => void;
      sendEnd: () => void;
    };
    getDisplay: () => {
      getWidth: () => number;
      getHeight: () => number;
      scale: (factor: number) => void;
    };
  } | null>(null);

  const [status, setStatus] = useState<ViewerStatus>('credentials');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [scaleToFit, setScaleToFit] = useState(true);
  const [launchInfo, setLaunchInfo] = useState<Tier2LaunchResponse | null>(null);

  const applyDisplayScale = useCallback(() => {
    const client = clientRef.current;
    const container = stageRef.current;
    if (!client || !container || !scaleToFit) return;
    const display = client.getDisplay();
    const width = display.getWidth();
    const height = display.getHeight();
    if (width <= 0 || height <= 0) return;
    const factor = Math.min(container.clientWidth / width, container.clientHeight / height, 1);
    display.scale(factor > 0 ? factor : 1);
  }, [scaleToFit]);

  const handleLaunchConnection = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('connecting');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/support/tier2/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          sessionId: session.id,
          username: username.trim() || undefined,
          password: password || undefined,
          domain: domain.trim() || undefined,
        }),
      });

      const body = (await response.json()) as Tier2LaunchResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || `Gateway rejected launch (${response.status})`);
      }

      setPassword('');
      setLaunchInfo(body);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unable to launch Tier 2 session');
    }
  };

  useEffect(() => {
    if (!launchInfo || !stageRef.current) return;
    let disposed = false;

    const mountClient = async () => {
      const guacamoleModule = await import('guacamole-common-js');
      if (disposed || !stageRef.current) return;

      const Guacamole = guacamoleModule.default;
      const tunnelUrl = `${launchInfo.gatewayWsUrl}?token=${encodeURIComponent(launchInfo.token)}`;
      const tunnel = new Guacamole.WebSocketTunnel(tunnelUrl);
      const client = new Guacamole.Client(tunnel);
      clientRef.current = client;

      const container = stageRef.current;
      const mountNode = displayMountRef.current;
      if (!container || !mountNode) return;
      mountNode.replaceChildren();
      const displayElement = client.getDisplay().getElement();
      mountNode.appendChild(displayElement);

      client.onstatechange = (nextState) => {
        if (nextState === 3) {
          setStatus('connected');
          applyDisplayScale();
        } else if (nextState === 5) {
          setStatus('error');
        }
      };

      client.onerror = (err) => {
        setStatus('error');
        setErrorMessage(err.message || `Guacamole tunnel error (${err.code})`);
      };

      const mouse = new Guacamole.Mouse(displayElement);
      mouse.onmousedown = (state) => client.sendMouseState(state);
      mouse.onmouseup = (state) => client.sendMouseState(state);
      mouse.onmousemove = (state) => client.sendMouseState(state);

      const keyboard = new Guacamole.Keyboard(document);
      keyboard.onkeydown = (keysym) => {
        client.sendKeyEvent(1, keysym);
        return true;
      };
      keyboard.onkeyup = (keysym) => {
        client.sendKeyEvent(0, keysym);
      };

      client.connect(`token=${encodeURIComponent(launchInfo.token)}`);
    };

    void mountClient().catch((err) => {
      if (!disposed) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load HTML5 viewer');
      }
    });

    return () => {
      disposed = true;
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [applyDisplayScale, launchInfo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', applyDisplayScale);
    return () => window.removeEventListener('resize', applyDisplayScale);
  }, [applyDisplayScale]);

  const handleSendCtrlAltDel = () => {
    const client = clientRef.current;
    if (!client) return;
    client.sendKeyEvent(1, KEYSYM_CTRL_LEFT);
    client.sendKeyEvent(1, KEYSYM_ALT_LEFT);
    client.sendKeyEvent(1, KEYSYM_DELETE);
    client.sendKeyEvent(0, KEYSYM_DELETE);
    client.sendKeyEvent(0, KEYSYM_ALT_LEFT);
    client.sendKeyEvent(0, KEYSYM_CTRL_LEFT);
    toast.info('Sent Ctrl+Alt+Del');
  };

  const handleSyncClipboard = async () => {
    const client = clientRef.current;
    if (!client || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      const text = await navigator.clipboard.readText();
      const guacamoleModule = await import('guacamole-common-js');
      const stream = client.createClipboardStream('text/plain');
      const writer = new guacamoleModule.default.StringWriter(stream);
      writer.sendText(text);
      writer.sendEnd();
      toast.success('Clipboard pushed to remote workstation');
    } catch {
      toast.error('Clipboard permission unavailable');
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

  const handleDisconnect = async () => {
    clientRef.current?.disconnect();
    await endRemoteSupportSession({
      sessionId: session.id,
      endReason: 'Tier 2 desktop session closed',
    }).catch(() => undefined);
    onSessionClosed();
  };

  return (
    <GlassCard className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-black/[0.06] border-b pb-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-[var(--accent-blue)]" />
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-xs">
              Tier 2 OS Desktop — {device.display_name} ({device.hostname})
            </h3>
            <p className="font-mono text-[10px] text-[var(--text-muted)]">
              {device.protocol.toUpperCase()} · {device.network_host}:{device.network_port}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={status !== 'connected'}
            onClick={handleSendCtrlAltDel}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 text-xs disabled:opacity-45"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Ctrl+Alt+Del</span>
          </button>

          <button
            type="button"
            disabled={status !== 'connected'}
            onClick={() => void handleSyncClipboard()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 text-xs disabled:opacity-45"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>Push Clipboard</span>
          </button>

          <button
            type="button"
            onClick={() => setScaleToFit((prev) => !prev)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 text-xs"
          >
            <Scaling className="h-3.5 w-3.5" />
            <span>{scaleToFit ? 'Fit Screen' : '1:1'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label="Toggle fullscreen desktop"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => void handleDisconnect()}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent-red)] px-3 font-semibold text-white text-xs"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {session.status !== 'active' ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Waiting for employee to approve OS desktop control on {device.hostname}…</span>
        </div>
      ) : status === 'credentials' || status === 'error' ? (
        <form
          onSubmit={handleLaunchConnection}
          className="flex flex-col gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-4"
        >
          {errorMessage && (
            <div className="rounded-lg border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 p-2.5 text-[var(--accent-red)] text-xs">
              {errorMessage}
            </div>
          )}
          <p className="text-[var(--text-secondary)] text-xs">
            Enter per-session OS credentials (encrypted inside a 60-second memory-only launch token,
            never persisted) or leave blank for interactive NLA/VNC prompt.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="OS Username (optional)"
              className="h-9 rounded-lg border border-black/10 bg-white px-3 text-xs"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="OS Password (optional)"
              className="h-9 rounded-lg border border-black/10 bg-white px-3 text-xs"
            />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Domain (optional)"
              className="h-9 rounded-lg border border-black/10 bg-white px-3 text-xs"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="h-9 rounded-lg bg-[var(--accent-blue)] px-4 font-semibold text-white text-xs"
            >
              Launch Tier 2 OS Desktop
            </button>
          </div>
        </form>
      ) : null}

      <div
        ref={stageRef}
        className="flex min-h-[420px] items-center justify-center overflow-auto rounded-xl border border-black/10 bg-black/95 outline-none"
      >
        <div ref={displayMountRef} className="flex items-center justify-center" />
        {status === 'connecting' && (
          <p className="font-mono text-white/75 text-xs">Opening encrypted guacd tunnel…</p>
        )}
      </div>
    </GlassCard>
  );
}
