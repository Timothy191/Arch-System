import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { FeedbackWidget } from './FeedbackWidget';

jest.mock('@repo/utils/client', () => ({
  analytics: { track: jest.fn() },
  fetchClient: { post: jest.fn().mockResolvedValue({ ok: true }) },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}));

describe('FeedbackWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header support button with Arch System Logo and opens the liquid-glass feedback dialog', () => {
    render(<FeedbackWidget variant="header" />);

    const triggerBtn = screen.getByTitle('Feedback & Support');
    expect(triggerBtn).toBeInTheDocument();
    expect(triggerBtn.querySelector('svg')).toHaveAttribute(
      'viewBox',
      '22.75 16.625 166.16 166.19'
    );

    fireEvent.click(triggerBtn);

    const dialog = screen.getByTestId('feedback-widget-popover');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('liquid-glass-light');

    const heading = screen.getByRole('heading', { name: /Feedback & Support/i });
    expect(heading).toHaveClass('font-anurati');
    expect(screen.getByText('DESK LIVE')).toBeInTheDocument();
    expect(screen.getByText('ARCH-OS // OPERATOR DISPATCH CHANNEL')).toBeInTheDocument();
  });

  it('switches dispatch categories and submits feedback with a Sonner toast notification', async () => {
    render(<FeedbackWidget variant="header" />);
    fireEvent.click(screen.getByTitle('Feedback & Support'));

    const featureBtn = screen.getByRole('radio', { name: /Feature/i });
    fireEvent.click(featureBtn);
    expect(featureBtn).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByText('Request an operational module or workflow enhancement')
    ).toBeInTheDocument();

    const textarea = screen.getByLabelText('Operational Details');
    fireEvent.change(textarea, {
      target: { value: 'Add equipment runtime telemetry export to Stock Control.' },
    });

    const submitBtn = screen.getByRole('button', { name: /Submit/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Feedback transmitted to Arch Support Desk');
    });
  });
});
