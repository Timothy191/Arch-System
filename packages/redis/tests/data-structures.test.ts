import { getRedisClient } from '../src/client';
import * as ds from '../src/data-structures';

jest.mock('../src/client', () => ({ getRedisClient: jest.fn() }));

describe('data-structures', () => {
  beforeEach(() => {
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand: jest.fn(async () => 'OK') });
  });

  it('streamAdd returns id', async () => {
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand: jest.fn(async () => '1-0') });
    const r = await ds.streamAdd('s', { a: 1 });
    expect(r).toBe('1-0');
  });

  it('pfCount returns number', async () => {
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand: jest.fn(async () => 3) });
    const r = await ds.pfCount(['k1', 'k2']);
    expect(r).toBe(3);
  });

  it('setBitFlag/getBitFlag', async () => {
    const sc = jest.fn(async () => 0);
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand: sc });
    await ds.setBitFlag('b', 5, 1);
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand: jest.fn(async () => 1) });
    const r = await ds.getBitFlag('b', 5);
    expect(r).toBe(1);
  });

  it('zadd returns count', async () => {
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand: jest.fn(async () => 2) });
    const r = await ds.zadd('z', [
      { member: 'a', score: 1 },
      { member: 'b', score: 2 },
    ]);
    expect(r).toBe(2);
  });
});
