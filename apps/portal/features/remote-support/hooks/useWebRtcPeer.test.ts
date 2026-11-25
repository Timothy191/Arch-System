import { act, renderHook, waitFor } from '@testing-library/react';
import { useWebRtcPeer } from './useWebRtcPeer';

const mockSendSignal = jest.fn().mockResolvedValue(true);
let capturedOnSignal: ((envelope: unknown) => void) | undefined;

jest.mock('./useRemoteSupportSignaling', () => ({
  useRemoteSupportSignaling: (opts: { onSignal?: (envelope: unknown) => void }) => {
    capturedOnSignal = opts.onSignal;
    return {
      status: 'SUBSCRIBED',
      isSubscribed: true,
      sendSignal: mockSendSignal,
    };
  },
}));

describe('useWebRtcPeer', () => {
  const trackStopMock = jest.fn();
  const trackAddEventListenerMock = jest.fn();
  const dataChannelSendMock = jest.fn();
  const dataChannelCloseMock = jest.fn();
  const pcCloseMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        relayAvailable: true,
        provider: 'cloudflare_calls',
        ttlSeconds: 3600,
      }),
    }) as unknown as typeof fetch;

    const fakeDataChannel = {
      readyState: 'open',
      send: dataChannelSendMock,
      close: dataChannelCloseMock,
      onmessage: null as ((event: { data: string }) => void) | null,
    };

    const fakePc = {
      connectionState: 'connected',
      remoteDescription: { type: 'offer' },
      addTrack: jest.fn(),
      createDataChannel: jest.fn(() => fakeDataChannel),
      createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
      createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addIceCandidate: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue(new Map()),
      close: pcCloseMock,
      onicecandidate: null as ((ev: { candidate: unknown }) => void) | null,
      onconnectionstatechange: null as (() => void) | null,
      ontrack: null as ((ev: { streams: unknown[]; track: unknown }) => void) | null,
      ondatachannel: null as ((ev: { channel: unknown }) => void) | null,
    };

    (global as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = jest.fn(() => fakePc);
    (global as unknown as { RTCIceCandidate: unknown }).RTCIceCandidate = jest.fn(
      (c: unknown) => c
    );
    (global as unknown as { MediaStream: unknown }).MediaStream = jest.fn(() => ({
      getTracks: () => [],
      getVideoTracks: () => [],
    }));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: trackStopMock }],
          getVideoTracks: () => [
            { addEventListener: trackAddEventListenerMock, stop: trackStopMock },
          ],
        }),
      },
    });
  });

  it('starts screen share, sends DataChannel messages, and disconnects cleanly', async () => {
    const onDataMessage = jest.fn();
    const { result, unmount } = renderHook(() =>
      useWebRtcPeer({
        sessionId: 'sess-1',
        role: 'requester',
        senderId: 'emp-1',
        onDataMessage,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    await waitFor(() => {
      expect(mockSendSignal).toHaveBeenCalledWith({
        type: 'offer',
        senderId: 'emp-1',
        sdp: 'offer-sdp',
      });
    });

    const sent = result.current.sendDataMessage({ type: 'annotation_clear' });
    expect(sent).toBe(true);
    expect(dataChannelSendMock).toHaveBeenCalledWith(JSON.stringify({ type: 'annotation_clear' }));

    await act(async () => {
      await result.current.disconnect('User closed');
    });

    expect(trackStopMock).toHaveBeenCalled();
    expect(pcCloseMock).toHaveBeenCalled();
    unmount();
  });

  it('handles incoming offer as agent and responds with answer', async () => {
    const onRemoteSessionEnded = jest.fn();
    renderHook(() =>
      useWebRtcPeer({
        sessionId: 'sess-1',
        role: 'agent',
        senderId: 'emp-agent',
        onRemoteSessionEnded,
      })
    );

    await act(async () => {
      capturedOnSignal?.({ type: 'offer', senderId: 'emp-user', sdp: 'remote-offer' });
    });

    await waitFor(() => {
      expect(mockSendSignal).toHaveBeenCalledWith({
        type: 'answer',
        senderId: 'emp-agent',
        sdp: 'answer-sdp',
      });
    });

    act(() => {
      capturedOnSignal?.({ type: 'session_end', senderId: 'emp-user', reason: 'Done' });
    });
    expect(onRemoteSessionEnded).toHaveBeenCalledWith('Done');
  });
});
