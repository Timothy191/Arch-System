'use client';

import { type WebRtcSignalEnvelope, webrtcSignalEnvelopeSchema } from '@repo/contract';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseRemoteSupportSignalingOptions {
  readonly sessionId: string | null;
  readonly senderId: string | null;
  readonly enabled?: boolean;
  readonly onSignal?: (envelope: WebRtcSignalEnvelope) => void;
}

export type SignalingChannelStatus = 'IDLE' | 'CONNECTING' | 'SUBSCRIBED' | 'ERROR' | 'CLOSED';

interface BroadcastChannelHandle {
  on(
    type: 'broadcast',
    filter: { event: string },
    callback: (payload: { payload?: unknown }) => void
  ): BroadcastChannelHandle;
  subscribe(callback?: (status: string) => void): BroadcastChannelHandle;
  send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>;
}

const SIGNAL_EVENT_NAME = 'webrtc_signal';

/**
 * Manages Supabase Realtime Broadcast signaling for a remote support session.
 * Automatically validates envelopes via Zod and tears down channels on unmount.
 */
export function useRemoteSupportSignaling({
  sessionId,
  senderId,
  enabled = true,
  onSignal,
}: UseRemoteSupportSignalingOptions) {
  const [status, setStatus] = useState<SignalingChannelStatus>('IDLE');
  const channelRef = useRef<BroadcastChannelHandle | null>(null);
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  const supabaseClient = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId || !supabaseClient) {
      setStatus('IDLE');
      return;
    }

    let isMounted = true;
    setStatus('CONNECTING');

    const channelName = `support:session:${sessionId}`;
    const channel = supabaseClient.channel(channelName, {
      config: { private: true, broadcast: { self: false } },
    }) as unknown as BroadcastChannelHandle;

    channelRef.current = channel;

    channel
      .on('broadcast', { event: SIGNAL_EVENT_NAME }, (message) => {
        if (!isMounted) return;
        const parsed = webrtcSignalEnvelopeSchema.safeParse(message.payload);
        if (!parsed.success) return;
        if (senderId && parsed.data.senderId === senderId) return;
        onSignalRef.current?.(parsed.data);
      })
      .subscribe((subscriptionStatus) => {
        if (!isMounted) return;
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('SUBSCRIBED');
        } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          setStatus('ERROR');
        } else if (subscriptionStatus === 'CLOSED') {
          setStatus('CLOSED');
        }
      });

    return () => {
      isMounted = false;
      channelRef.current = null;
      supabaseClient.removeChannel(channel as never).catch(() => undefined);
    };
  }, [enabled, sessionId, senderId, supabaseClient]);

  const sendSignal = useCallback(async (envelope: WebRtcSignalEnvelope): Promise<boolean> => {
    const channel = channelRef.current;
    if (!channel) return false;
    try {
      await channel.send({
        type: 'broadcast',
        event: SIGNAL_EVENT_NAME,
        payload: envelope,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    status,
    isSubscribed: status === 'SUBSCRIBED',
    sendSignal,
  };
}
