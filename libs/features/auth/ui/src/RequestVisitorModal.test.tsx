import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { type IssuedVisitorPass, RequestVisitorModal } from './RequestVisitorModal';

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const HTTP_CREATED = 201;
const HTTP_TOO_MANY_REQUESTS = 429;

const SAMPLE_ISSUED_PASS: IssuedVisitorPass = {
  qrCode: 'VIS-884120',
  visitorId: 'vis-884120',
  fullName: 'Sipho Dlamini',
  company: 'Komatsu SA',
  visiting: 'Engineering Workshop',
  status: 'Pre-Registered',
  expiresAt: '2026-11-20T18:00:00.000Z',
};

describe('RequestVisitorModal (@repo/auth/ui)', () => {
  const mockOnClose = jest.fn();
  const mockFetch = jest.fn();

  function populateRequiredFields() {
    fireEvent.change(screen.getByLabelText(/Visitor Name/i), {
      target: { value: '  Sipho  ' },
    });
    fireEvent.change(screen.getByLabelText(/Visitor Surname/i), {
      target: { value: '  Dlamini  ' },
    });
    fireEvent.change(screen.getByLabelText(/Visitor Company/i), {
      target: { value: '  Komatsu SA  ' },
    });
    fireEvent.change(screen.getByLabelText(/Person Being Visited/i), {
      target: { value: '  Engineering Workshop  ' },
    });
    fireEvent.change(screen.getByLabelText(/Reason for Visit/i), {
      target: { value: '  Hydraulic pump inspection  ' },
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('should render nothing when isOpen is false', () => {
    render(<RequestVisitorModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render modal dialog when open and dismiss on Escape key, Cancel button, or backdrop click', () => {
    render(<RequestVisitorModal isOpen={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole('dialog', { name: /Request Visitor Pass/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(2);

    const presentationOverlay = dialog.parentElement;
    expect(presentationOverlay).not.toBeNull();
    if (presentationOverlay) {
      fireEvent.click(presentationOverlay);
    }
    expect(mockOnClose).toHaveBeenCalledTimes(3);
  });

  it('should show validation error when required fields contain only whitespace and clear error on edit', () => {
    render(<RequestVisitorModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText(/Visitor Name/i), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/Visitor Surname/i), { target: { value: 'Dlamini' } });
    fireEvent.change(screen.getByLabelText(/Visitor Company/i), {
      target: { value: 'Komatsu SA' },
    });
    fireEvent.change(screen.getByLabelText(/Person Being Visited/i), {
      target: { value: 'Control Room' },
    });
    fireEvent.change(screen.getByLabelText(/Reason for Visit/i), {
      target: { value: 'Audit' },
    });

    fireEvent.submit(screen.getByTestId('visitor-request-form'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please complete all required visitor pass fields.'
    );
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Visitor Name/i), { target: { value: 'Sipho' } });
    expect(
      screen.queryByText('Please complete all required visitor pass fields.')
    ).not.toBeInTheDocument();
  });

  it('should submit trimmed payload, display issued pass view with custom QR renderer, copy QR code, and support New Request reset', async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: HTTP_CREATED,
      json: jest.fn().mockResolvedValue({
        success: true,
        pass: SAMPLE_ISSUED_PASS,
      }),
    });

    render(
      <RequestVisitorModal
        isOpen={true}
        onClose={mockOnClose}
        renderQrCode={(qrCode) => <div data-testid="custom-qr-renderer">{qrCode}</div>}
      />
    );

    populateRequiredFields();
    fireEvent.change(screen.getByLabelText(/ID \/ Passport Number/i), {
      target: { value: '  8901015009087  ' },
    });

    fireEvent.submit(screen.getByTestId('visitor-request-form'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/visitor-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Sipho',
          surname: 'Dlamini',
          company: 'Komatsu SA',
          visiting: 'Engineering Workshop',
          reason_for_entry: 'Hydraulic pump inspection',
          id_number: '8901015009087',
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Pending Visitor QR Pass Ready')).toBeInTheDocument();
    });

    expect(screen.getByTestId('custom-qr-renderer')).toHaveTextContent('VIS-884120');
    expect(screen.getByText('Sipho Dlamini · Komatsu SA')).toBeInTheDocument();
    expect(screen.getByText('Visiting: Engineering Workshop')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Visitor pass VIS-884120 pre-registered');

    const copyButton = screen.getByRole('button', { name: 'Copy visitor QR code' });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('VIS-884120');
    });
    expect(toast.success).toHaveBeenCalledWith('Visitor QR reference copied');

    fireEvent.click(screen.getByRole('button', { name: /^New Request$/i }));
    expect(screen.getByTestId('visitor-request-form')).toBeInTheDocument();
  });

  it('should display API error alert and toast when visitor pass request returns non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: HTTP_TOO_MANY_REQUESTS,
      json: jest.fn().mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded for visitor registrations.',
      }),
    });

    render(<RequestVisitorModal isOpen={true} onClose={mockOnClose} />);

    populateRequiredFields();
    fireEvent.submit(screen.getByTestId('visitor-request-form'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Rate limit exceeded for visitor registrations.'
      );
    });
    expect(toast.error).toHaveBeenCalledWith('Rate limit exceeded for visitor registrations.');
  });

  it('should display network error alert and toast when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network offline'));

    render(<RequestVisitorModal isOpen={true} onClose={mockOnClose} />);

    populateRequiredFields();
    fireEvent.submit(screen.getByTestId('visitor-request-form'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Network error while requesting visitor pass. Please try again.'
      );
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Network error while requesting visitor pass. Please try again.'
    );
  });
});
