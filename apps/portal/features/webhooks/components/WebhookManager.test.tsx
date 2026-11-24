import '@testing-library/jest-dom';
import { fetchClient } from '@repo/utils/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { WebhookManager } from './WebhookManager';

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

  it('lists webhooks, applies templates to create a webhook, and confirms deletion via Radix Dialog', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    mockFetchClient.get.mockResolvedValue({
      webhooks: [
        {
          id: 'wh-1',
          url: 'https://n8n.plantcor.example/webhook/shift',
          description: 'Shift feed',
          event_types: ['daily_log.created'],
          active: true,
          created_at: '2026-11-20T08:00:00Z',
          updated_at: '2026-11-20T08:00:00Z',
        },
      ],
    });
    mockFetchClient.post.mockResolvedValue({ id: 'wh-2' });
    mockFetchClient.delete.mockResolvedValue({ success: true });

    render(<WebhookManager />);

    await waitFor(() => {
      expect(screen.getByText('https://n8n.plantcor.example/webhook/shift')).toBeInTheDocument();
    });

    // Apply template -> form opens -> enter URL -> submit
    fireEvent.click(screen.getByRole('button', { name: /Use Breakdown Alerts template/i }));
    fireEvent.change(screen.getByPlaceholderText('https://api.example.com/webhooks'), {
      target: { value: 'https://n8n.plantcor.example/webhook/breakdowns' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Webhook/i }));

    await waitFor(() => {
      expect(mockFetchClient.post).toHaveBeenCalledWith(
        '/api/webhooks',
        expect.objectContaining({
          url: 'https://n8n.plantcor.example/webhook/breakdowns',
        })
      );
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
