import { computeBackoff, createPooledClient } from '../src/client-factory';

describe('client-factory', () => {
  it('connects and disconnects', async () => {
    const c = createPooledClient({ highWatermark: 50 });
    expect(c.config.highWatermark).toBe(50);
    await c.connect();
    expect(c.isConnected()).toBe(true);
    await c.disconnect();
    expect(c.isConnected()).toBe(false);
  });

  it('computes bounded backoff', () => {
    const b = computeBackoff(3, 100, 500);
    expect(b).toBeGreaterThanOrEqual(500);
    expect(b).toBeLessThanOrEqual(625);
  });
});
