import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DepartmentReviews } from './DepartmentReviews';

describe('DepartmentReviews', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'healthy',
        latencyMs: 37,
        services: {
          supabase: { status: 'healthy', latencyMs: 14 },
          redis: { status: 'healthy', latencyMs: 5, mode: 'tcp' },
          fuxa: { status: 'healthy', latencyMs: 22 },
        },
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('renders the horizontal sliding environment carousel for Server, Database, and User System', async () => {
    render(<DepartmentReviews />);

    const track = screen.getByTestId('footer-slide-track');
    expect(track).toHaveStyle({ transform: 'translateX(-0%)' });

    await waitFor(() => {
      expect(screen.getByText('37ms RTT')).toBeInTheDocument();
      expect(screen.getByText('14ms Avg')).toBeInTheDocument();
    });

    expect(screen.getByTestId('footer-slide-server')).toBeInTheDocument();
    expect(screen.getByTestId('footer-slide-database')).toBeInTheDocument();
    expect(screen.getByTestId('footer-slide-system')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next environment slide' }));
    expect(track).toHaveStyle({ transform: 'translateX(-100%)' });

    fireEvent.click(screen.getByRole('button', { name: 'Next environment slide' }));
    expect(track).toHaveStyle({ transform: 'translateX(-200%)' });

    fireEvent.click(screen.getByRole('button', { name: 'Previous environment slide' }));
    expect(track).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('auto-advances slides every 5s and supports pause/resume toggle', async () => {
    render(<DepartmentReviews />);

    await waitFor(() => {
      expect(screen.getByText('37ms RTT')).toBeInTheDocument();
    });

    const track = screen.getByTestId('footer-slide-track');
    expect(track).toHaveStyle({ transform: 'translateX(-0%)' });

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(track).toHaveStyle({ transform: 'translateX(-100%)' });

    fireEvent.click(screen.getByRole('button', { name: 'Pause slide animation' }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(track).toHaveStyle({ transform: 'translateX(-100%)' });

    fireEvent.click(screen.getByRole('button', { name: 'Resume slide animation' }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(track).toHaveStyle({ transform: 'translateX(-200%)' });
  });

  it('opens and closes the Infrastructure & Client Preview modal and refreshes telemetry', async () => {
    render(<DepartmentReviews />);

    await waitFor(() => {
      expect(screen.getByText('37ms RTT')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId('footer-preview-toggle');
    fireEvent.click(toggleBtn);

    const dialog = screen.getByTestId('footer-environment-preview-dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL 17 · Managed Supabase Cloud')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh environment telemetry' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('footer-environment-preview-dialog')).not.toBeInTheDocument();
  });

  it('keeps baseline telemetry gracefully when /api/health probe fails', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network down')) as unknown as typeof fetch;
    render(<DepartmentReviews />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('footer-slide-server')).toBeInTheDocument();
    expect(screen.getByText('18ms Avg')).toBeInTheDocument();
  });
});
