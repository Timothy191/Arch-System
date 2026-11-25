'use client';

import {
  type AssistDataChannelMessage,
  assistDataChannelMessageSchema,
  type IceServerConfig,
  type IceServersResponse,
  type WebRtcSignalEnvelope,
} from '@repo/contract';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRemoteSupportSignaling } from './useRemoteSupportSignaling';

const STATS_POLL_INTERVAL_MS = 3000;
const DATA_CHANNEL_LABEL = 'arch-assist-control';

export type WebRtcPeerPhase =
  | { readonly phase: 'idle' }
  | { readonly phase: 'fetching_ice' }
  | { readonly phase: 'awaiting_capture' }
  | { readonly phase: 'connecting' }
  | { readonly phase: 'connected' }
  | { readonly phase: 'reconnecting' }
  | { readonly phase: 'disconnected'; readonly reason?: string }
  | { readonly phase: 'error'; readonly message: string };

export interface WebRtcTelemetryStats {
  readonly rttMs: number | null;
  readonly fps: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly candidateType: string | null;
  readonly relayAvailable: boolean;
}

export interface UseWebRtcPeerOptions {
  readonly sessionId: string | null;
  readonly role: 'requester' | 'agent';
  readonly senderId: string | null;
  readonly enabled?: boolean;
  readonly onDataMessage?: (message: AssistDataChannelMessage) => void;
  readonly onStreamEnded?: () => void;
  readonly onRemoteSessionEnded?: (reason?: string) => void;
}

async function fetchSessionIceServers(sessionId: string): Promise<IceServersResponse> {
  const response = await fetch('/api/support/ice-servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ICE servers (${response.status})`);
  }
  return (await response.json()) as IceServersResponse;
}

function createPeerConnection(iceServers: readonly IceServerConfig[]): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: iceServers.map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential,
    })),
  });
}

/**
 * Dual-role WebRTC peer hook for Tier 1 browser screen-sharing and DataChannel
 * assistance. Manages ICE negotiation, polite SDP exchange, stats polling, and
 * full media/channel teardown on unmount.
 */
export function useWebRtcPeer({
  sessionId,
  role,
  senderId,
  enabled = true,
  onDataMessage,
  onStreamEnded,
  onRemoteSessionEnded,
}: UseWebRtcPeerOptions) {
  const [peerState, setPeerState] = useState<WebRtcPeerPhase>({ phase: 'idle' });
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [telemetry, setTelemetry] = useState<WebRtcTelemetryStats>({
    rttMs: null,
    fps: null,
    width: null,
    height: null,
    candidateType: null,
    relayAvailable: false,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const onDataMessageRef = useRef(onDataMessage);
  onDataMessageRef.current = onDataMessage;
  const onStreamEndedRef = useRef(onStreamEnded);
  onStreamEndedRef.current = onStreamEnded;
  const onRemoteSessionEndedRef = useRef(onRemoteSessionEnded);
  onRemoteSessionEndedRef.current = onRemoteSessionEnded;

  const cleanupPeer = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const wireDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannelRef.current = channel;
    channel.onmessage = (event) => {
      try {
        const parsedJson = JSON.parse(String(event.data));
        const parsed = assistDataChannelMessageSchema.safeParse(parsedJson);
        if (parsed.success) {
          onDataMessageRef.current?.(parsed.data);
        }
      } catch {
        // Ignore malformed DataChannel frame
      }
    };
  }, []);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queued = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
    }
  }, []);

  const sendSignalRef = useRef<(envelope: WebRtcSignalEnvelope) => Promise<boolean>>(
    async () => false
  );

  const ensurePeerInitialized = useCallback(
    async (targetSessionId: string): Promise<RTCPeerConnection> => {
      if (pcRef.current) {
        return pcRef.current;
      }

      setPeerState({ phase: 'fetching_ice' });
      const iceResponse = await fetchSessionIceServers(targetSessionId);
      setTelemetry((prev) => ({ ...prev, relayAvailable: iceResponse.relayAvailable }));

      const pc = createPeerConnection(iceResponse.iceServers);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (!event.candidate || !senderId) return;
        void sendSignalRef.current({
          type: 'ice_candidate',
          senderId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setPeerState({ phase: 'connected' });
        } else if (pc.connectionState === 'disconnected') {
          setPeerState({ phase: 'reconnecting' });
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          setPeerState({ phase: 'disconnected', reason: pc.connectionState });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStream(stream);
      };

      pc.ondatachannel = (event) => {
        wireDataChannel(event.channel);
      };

      return pc;
    },
    [senderId, wireDataChannel]
  );

  const handleIncomingSignal = useCallback(
    async (envelope: WebRtcSignalEnvelope) => {
      if (!sessionId || !senderId) return;

      if (envelope.type === 'session_end') {
        cleanupPeer();
        setPeerState({ phase: 'disconnected', reason: envelope.reason });
        onRemoteSessionEndedRef.current?.(envelope.reason);
        return;
      }

      if (envelope.type === 'offer' && role === 'agent') {
        const pc = await ensurePeerInitialized(sessionId);
        setPeerState({ phase: 'connecting' });
        await pc.setRemoteDescription({ type: 'offer', sdp: envelope.sdp });
        await flushPendingCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (answer.sdp) {
          await sendSignalRef.current({
            type: 'answer',
            senderId,
            sdp: answer.sdp,
          });
        }
        return;
      }

      if (envelope.type === 'answer' && role === 'requester') {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: envelope.sdp });
        await flushPendingCandidates(pc);
        return;
      }

      if (envelope.type === 'ice_candidate') {
        const pc = pcRef.current;
        if (!pc?.remoteDescription) {
          pendingIceCandidatesRef.current.push(envelope.candidate);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(envelope.candidate)).catch(() => undefined);
      }
    },
    [cleanupPeer, ensurePeerInitialized, flushPendingCandidates, role, senderId, sessionId]
  );

  const signaling = useRemoteSupportSignaling({
    sessionId,
    senderId,
    enabled,
    onSignal: (envelope) => {
      void handleIncomingSignal(envelope);
    },
  });

  sendSignalRef.current = signaling.sendSignal;

  /**
   * Requester-only: Must be invoked directly inside the user's explicit Consent
   * Modal click handler so `getDisplayMedia()` satisfies browser user-gesture rules.
   */
  const startScreenShare = useCallback(async () => {
    if (role !== 'requester' || !sessionId || !senderId) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setPeerState({
        phase: 'error',
        message: 'Screen capture is not supported in this browser.',
      });
      return;
    }

    try {
      setPeerState({ phase: 'awaiting_capture' });
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          cleanupPeer();
          setPeerState({ phase: 'disconnected', reason: 'Screen share stopped by user' });
          onStreamEndedRef.current?.();
        });
      }

      const pc = await ensurePeerInitialized(sessionId);
      setPeerState({ phase: 'connecting' });
      const channel = pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
      wireDataChannel(channel);

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (offer.sdp) {
        await signaling.sendSignal({
          type: 'offer',
          senderId,
          sdp: offer.sdp,
        });
      }
    } catch (err) {
      cleanupPeer();
      setPeerState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Screen share cancelled or blocked',
      });
      throw err;
    }
  }, [cleanupPeer, ensurePeerInitialized, role, senderId, sessionId, signaling, wireDataChannel]);

  const sendDataMessage = useCallback((message: AssistDataChannelMessage): boolean => {
    const channel = dataChannelRef.current;
    if (channel?.readyState !== 'open') {
      return false;
    }
    try {
      channel.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }, []);

  const disconnect = useCallback(
    async (reason?: string) => {
      if (senderId) {
        await signaling.sendSignal({ type: 'session_end', senderId, reason });
      }
      cleanupPeer();
      setPeerState({ phase: 'disconnected', reason });
    },
    [cleanupPeer, senderId, signaling]
  );

  // Poll WebRTC connection telemetry while connected
  useEffect(() => {
    if (typeof window === 'undefined' || peerState.phase !== 'connected') {
      return;
    }

    const timer = window.setInterval(() => {
      const pc = pcRef.current;
      if (!pc) return;
      void pc
        .getStats()
        .then((stats) => {
          let rttMs: number | null = null;
          let fps: number | null = null;
          let width: number | null = null;
          let height: number | null = null;
          let candidateType: string | null = null;

          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (typeof report.currentRoundTripTime === 'number') {
                rttMs = Math.round(report.currentRoundTripTime * 1000);
              }
            }
            if (report.type === 'remote-candidate' || report.type === 'local-candidate') {
              if (!candidateType && typeof report.candidateType === 'string') {
                candidateType = report.candidateType;
              }
            }
            if (
              (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') &&
              report.kind === 'video'
            ) {
              if (typeof report.framesPerSecond === 'number') {
                fps = Math.round(report.framesPerSecond);
              }
              if (typeof report.frameWidth === 'number') width = report.frameWidth;
              if (typeof report.frameHeight === 'number') height = report.frameHeight;
            }
          });

          setTelemetry((prev) => ({
            ...prev,
            rttMs,
            fps,
            width,
            height,
            candidateType,
          }));
        })
        .catch(() => undefined);
    }, STATS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [peerState.phase]);

  // Tear down WebRTC peer & media tracks on unmount or session change
  useEffect(() => {
    return () => {
      cleanupPeer();
    };
  }, [cleanupPeer, sessionId]);

  return {
    peerState,
    signalingStatus: signaling.status,
    remoteStream,
    localStream,
    telemetry,
    startScreenShare,
    sendDataMessage,
    disconnect,
  };
}
