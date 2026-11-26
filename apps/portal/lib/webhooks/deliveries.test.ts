/**
 * @jest-environment node
 */

import { deliverQueuedWebhooks } from './deliveries';

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

const { createServiceRoleClient } = jest.requireMock('@repo/supabase/service-role');

function buildClient(endpointUrl = 'https://example.com/hook') {
  const update = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });
  const client = {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'webhook_endpoints') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'wh-1', url: endpointUrl, secret: 'secret' },
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'log-1',
                      webhook_endpoint_id: 'wh-1',
                      event_type: 'breakdown.created',
                      payload: { id: 'bd-1' },
                      retry_count: 0,
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
        update,
      };
    }),
  };
  createServiceRoleClient.mockReturnValue(client);
  return { client, update };
}

describe('deliverQueuedWebhooks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delivers a queued webhook and records the result', async () => {
    const { update } = buildClient();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('ok'),
    } as unknown as Response);

    const summary = await deliverQueuedWebhooks();

    expect(summary).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, retry_count: 1, error_message: null })
    );
    fetchMock.mockRestore();
  });

  it('records failed deliveries with retry metadata', async () => {
    const { update } = buildClient();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('boom'),
    } as unknown as Response);

    const summary = await deliverQueuedWebhooks();

    expect(summary).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, retry_count: 1, response_status: 500 })
    );
    fetchMock.mockRestore();
  });

  it('blocks SSRF against private/internal URLs before issuing fetch', async () => {
    const { update } = buildClient('http://127.0.0.1:8080/internal-hook');
    const fetchMock = jest.spyOn(global, 'fetch');

    const summary = await deliverQueuedWebhooks();

    expect(summary).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        retry_count: 1,
        error_message: expect.stringContaining('disallowed host'),
      })
    );
    fetchMock.mockRestore();
  });
});
