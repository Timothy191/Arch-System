import '@testing-library/jest-dom';
import { fetchClient } from '@repo/utils/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { WebhookManager } from './WebhookManager';

const DEPT_ID = '11111111-1111-4111-a111-111111111111';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [{ id: DEPT_ID, name: 'control-room', display_name: 'Control Room' }],
          }),
        }),
      }),
    })),
  })),
}));

jest.mock('@repo/utils/client', () => ({
  fetchClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@repo/ui/AnimeStagger', () => ({
  AnimeStagger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockFetchClient = jest.mocked(fetchClient);

describe('WebhookManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists webhooks, selects department & secret on create, updates without page reload, inspects logs/metrics, and confirms deletion via Radix Dialog', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    mockFetchClient.get.mockImplementation(async (url: string) => {
      if (url === '/api/webhooks') {
        return {
          webhooks: [
            {
              id: 'wh-1',
              url: 'https://n8n.plantcor.example/webhook/shift',
              description: 'Shift feed',
              department_id: DEPT_ID,
              event_types: ['daily_log.created'],
              active: true,
              created_at: '2026-11-20T08:00:00Z',
              updated_at: '2026-11-20T08:00:00Z',
            },
          ],
        };
      }
      if (url === '/api/webhooks/wh-1/logs') {
        return {
          logs: [
            {
              id: 'log-1',
              event_type: 'daily_log.created',
              response_status: 200,
              retry_count: 0,
              success: true,
              error_message: null,
              created_at: '2026-11-20T08:05:00Z',
            },
          ],
        };
      }
      if (url === '/api/webhooks/wh-1/metrics') {
        return {
          total: 4,
          successful: 3,
          failed: 1,
          retried: 1,
          successRate: 75,
          lastDeliveredAt: '2026-11-20T08:05:00Z',
        };
      }
      return {};
    });
    mockFetchClient.post.mockResolvedValue({ id: 'wh-2' });
    mockFetchClient.put.mockResolvedValue({ id: 'wh-1' });
    mockFetchClient.delete.mockResolvedValue({ success: true });

    render(<WebhookManager />);

    await waitFor(() => {
      expect(screen.getByText('https://n8n.plantcor.example/webhook/shift')).toBeInTheDocument();
    });

    // Apply template -> form opens -> enter URL & optional secret -> submit
    fireEvent.click(screen.getByRole('button', { name: /Use Breakdown Alerts template/i }));
    fireEvent.change(screen.getByPlaceholderText('https://api.example.com/webhooks'), {
      target: { value: 'https://n8n.plantcor.example/webhook/breakdowns' },
    });
    fireEvent.change(screen.getByLabelText(/HMAC Signing Secret/i), {
      target: { value: 'super-secret-hmac-key-2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Webhook/i }));

    await waitFor(() => {
      expect(mockFetchClient.post).toHaveBeenCalledWith(
        '/api/webhooks',
        expect.objectContaining({
          url: 'https://n8n.plantcor.example/webhook/breakdowns',
          department_id: DEPT_ID,
          secret: 'super-secret-hmac-key-2026',
          active: true,
        })
      );
    });

    // Edit existing webhook via form submit (preventDefault + PUT)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('https://api.example.com/webhooks'), {
      target: { value: 'https://n8n.plantcor.example/webhook/shift-v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Update Webhook/i }));

    await waitFor(() => {
      expect(mockFetchClient.put).toHaveBeenCalledWith(
        '/api/webhooks/wh-1',
        expect.objectContaining({
          url: 'https://n8n.plantcor.example/webhook/shift-v2',
        })
      );
    });

    // Inspect Delivery Logs & Metrics panel
    fireEvent.click(screen.getByRole('button', { name: /Inspect delivery logs and metrics/i }));
    await waitFor(() => {
      expect(screen.getByText('Success Rate: 75%')).toBeInTheDocument();
      expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    });

    // Delete via Radix Dialog instead of window.confirm
    fireEvent.click(screen.getByRole('button', { name: 'Delete webhook' }));
    expect(screen.getByText('Delete Webhook')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => {
      expect(mockFetchClient.delete).toHaveBeenCalledWith('/api/webhooks/wh-1');
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
