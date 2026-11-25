import { act, renderHook } from '@testing-library/react';
import { useRemoteSupportSignaling } from './useRemoteSupportSignaling';

const mockRemoveChannel = jest.fn().mockResolvedValue(undefined);
const mockSend = jest.fn().mockResolvedValue('ok');
let registeredBroadcastCb: ((msg: { payload?: unknown }) => void) | null = null;
let registeredSubscribeCb: ((status: string) => void) | null = null;

const mockChannelObj = {
  on: jest.fn((_type, _filter, cb) => {
    registeredBroadcastCb = cb;
    return mockChannelObj;
  }),
  subscribe: jest.fn((cb) => {
    registeredSubscribeCb = cb;
    return mockChannelObj;
  }),
  send: mockSend,
};

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    channel: jest.fn(() => mockChannelObj),
    removeChannel: mockRemoveChannel,
  }),
}));

describe('useRemoteSupportSignaling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registeredBroadcastCb = null;
    registeredSubscribeCb = null;
  });

  it('subscribes, validates signals, filters own senderId, sends signals, and cleans up', async () => {
    const onSignal = jest.fn();
    const { result, unmount } = renderHook(() =>
      useRemoteSupportSignaling({
        sessionId: 'sess-1',
        senderId: 'emp-1',
        enabled: true,
        onSignal,
      })
    );

    act(() => {
      registeredSubscribeCb?.('SUBSCRIBED');
    });
    expect(result.current.status).toBe('SUBSCRIBED');
    expect(result.current.isSubscribed).toBe(true);

    // Self-sent envelope is ignored
    act(() => {
      registeredBroadcastCb?.({
        payload: { type: 'offer', senderId: 'emp-1', sdp: 'v=0' },
      });
    });
    expect(onSignal).not.toHaveBeenCalled();

    // Remote valid envelope is delivered
    act(() => {
      registeredBroadcastCb?.({
        payload: { type: 'answer', senderId: 'emp-2', sdp: 'v=0' },
      });
    });
    expect(onSignal).toHaveBeenCalledWith({
      type: 'answer',
      senderId: 'emp-2',
      sdp: 'v=0',
    });

    // Malformed envelope is ignored
    act(() => {
      registeredBroadcastCb?.({ payload: { invalid: true } });
    });
    expect(onSignal).toHaveBeenCalledTimes(1);

    const sent = await result.current.sendSignal({
      type: 'session_end',
      senderId: 'emp-1',
      reason: 'Done',
    });
    expect(sent).toBe(true);
    expect(mockSend).toHaveBeenCalled();

    act(() => {
      registeredSubscribeCb?.('CHANNEL_ERROR');
    });
    expect(result.current.status).toBe('ERROR');

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
