import { auditBigKeys, auditHotKeys } from '../src/audit';
import { getRedisClient } from '../src/client';

jest.mock('../src/client', () => ({ getRedisClient: jest.fn() }));
jest.mock('../src/stats', () => ({
  collectRedisHealthDiagnostics: jest.fn(async () => ({ slowlogCount: 5 })),
}));

describe('audit', () => {
  it('finds big keys above threshold', async () => {
    const sendCommand = jest
      .fn()
      .mockResolvedValueOnce(['0', ['k1']])
      .mockResolvedValueOnce('string')
      .mockResolvedValueOnce(2048);
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand });
    const res = await auditBigKeys({ sizeThresholdBytes: 1024 });
    expect(res).toEqual([{ key: 'k1', type: 'string', size: 2048 }]);
  });

  it('returns hot keys from diagnostics', async () => {
    const res = await auditHotKeys({ topN: 5 });
    expect(res[0]?.freq).toBe(5);
  });
});
