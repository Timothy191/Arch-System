import { getRedisClient } from '../src/client';
import { runPipeline } from '../src/pipeline';

jest.mock('../src/client', () => ({ getRedisClient: jest.fn() }));

describe('runPipeline', () => {
  it('chunks commands and executes via pipeline or sendSafe fallback', async () => {
    const sendCommand = jest.fn(async () => 'OK');
    (getRedisClient as jest.Mock).mockResolvedValue({ sendCommand });

    const res = await runPipeline(
      [
        ['SET', 'k1', 'v1'],
        ['SET', 'k2', 'v2'],
        ['UNLINK', 'k1'],
      ],
      { batchSize: 2 }
    );
    expect(res).toHaveLength(3);
  });

  it('returns empty array for empty commands', async () => {
    const res = await runPipeline([]);
    expect(res).toEqual([]);
  });
});
