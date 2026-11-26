import { APIError, ValidationError } from '@repo/errors';

const mockTrigger = jest.fn();
const mockNovuConstructor = jest.fn((..._args: unknown[]) => ({
  trigger: mockTrigger,
}));

jest.mock('@novu/node', () => ({
  Novu: function MockNovu(...args: unknown[]) {
    return mockNovuConstructor(...args);
  },
}));

import { dispatchOperationalAlert, sendOperationalAlert } from './novu';

describe('@repo/utils/novu', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NOVU_API_KEY: 'test-novu-secret-key',
    };
    delete process.env.NOVU_API_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws ValidationError when NOVU_API_KEY is missing', async () => {
    delete process.env.NOVU_API_KEY;

    await expect(
      sendOperationalAlert('access-control-ops', 'contractor-expiry-alert', { count: 2 })
    ).rejects.toThrow(ValidationError);
    expect(mockNovuConstructor).not.toHaveBeenCalled();
  });

  it('throws ValidationError when subscriberId or workflowId is blank', async () => {
    await expect(
      dispatchOperationalAlert({
        subscriberId: '   ',
        workflowId: 'contractor-expiry-alert',
        payload: {},
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      dispatchOperationalAlert({
        subscriberId: 'access-control-ops',
        workflowId: '',
        payload: {},
      })
    ).rejects.toThrow(ValidationError);
  });

  it('dispatches workflow with optional NOVU_API_URL and transactionId', async () => {
    process.env.NOVU_API_URL = 'https://api.novu.co';
    mockTrigger.mockResolvedValueOnce({
      data: {
        acknowledged: true,
        status: 'processed',
        transactionId: 'tx-12345',
      },
    });

    const receipt = await dispatchOperationalAlert({
      subscriberId: 'access-control-ops',
      workflowId: 'contractor-expiry-alert',
      payload: { expiringCount: 3 },
      transactionId: 'dedupe-tx-1',
    });

    expect(mockNovuConstructor).toHaveBeenCalledWith('test-novu-secret-key', {
      backendUrl: 'https://api.novu.co',
    });
    expect(mockTrigger).toHaveBeenCalledWith('contractor-expiry-alert', {
      to: { subscriberId: 'access-control-ops' },
      payload: { expiringCount: 3 },
      transactionId: 'dedupe-tx-1',
    });
    expect(receipt).toEqual({
      acknowledged: true,
      status: 'processed',
      transactionId: 'tx-12345',
    });
  });

  it('supports backward-compatible sendOperationalAlert signature', async () => {
    mockTrigger.mockResolvedValueOnce({
      data: { acknowledged: true, transactionId: 'tx-compat' },
    });

    const receipt = await sendOperationalAlert('engineering-ops', 'equipment-breakdown-alert', {
      equipmentId: 'EXC-09',
    });

    expect(mockNovuConstructor).toHaveBeenCalledWith('test-novu-secret-key');
    expect(receipt.acknowledged).toBe(true);
    expect(receipt.transactionId).toBe('tx-compat');
  });

  it('wraps transport failures in APIError with cause and no secret leakage', async () => {
    const transportErr = new Error('workflow_not_found');
    mockTrigger.mockRejectedValueOnce(transportErr);

    let caughtError: unknown;
    try {
      await sendOperationalAlert('platform-ops', 'observability-slo-breach', { targetId: 'redis' });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(APIError);
    expect((caughtError as APIError).message).toContain('observability-slo-breach');
    expect((caughtError as APIError).message).not.toContain('test-novu-secret-key');
    expect((caughtError as Error).cause).toBe(transportErr);
  });
});
