import { send, sendSafe } from '../src/raw';

describe('raw denylist', () => {
  const client = { sendCommand: jest.fn(async () => 'OK') } as unknown as Parameters<
    typeof send
  >[0];

  it('blocks KEYS by default', async () => {
    await expect(send(client, ['KEYS', '*'])).rejects.toThrow(/denied/i);
  });

  it('allows KEYS with allowDangerous', async () => {
    const r = await send(client, ['KEYS', '*'], { allowDangerous: true });
    expect(r).toBe('OK');
  });

  it('sendSafe returns null for blocked command', async () => {
    const r = await sendSafe(client, ['FLUSHALL']);
    expect(r).toBeNull();
  });
});
