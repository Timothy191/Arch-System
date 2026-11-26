import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { revokeBadgeCredential } from '../qr-codes/actions';
import { BadgesRegistryClient, type ResolvedDepartmentBadge } from './BadgesRegistryClient';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@repo/shared/hooks', () => ({
  useSupabaseRealtime: jest.fn(),
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({}),
}));

jest.mock('../components/QRCodeSection', () => ({
  QRCodeSection: ({ data, size }: { data: string; size?: number }) => (
    <div data-testid="qr-code-section" data-qr={data} data-size={size}>
      {data}
    </div>
  ),
}));

jest.mock('../qr-codes/actions', () => ({
  revokeBadgeCredential: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const SAMPLE_BADGES: readonly ResolvedDepartmentBadge[] = [
  {
    id: 'badge-1',
    qr_code: 'EMP-10001',
    entity_type: 'personnel',
    entity_name: 'Thabo Mokoena',
    is_active: true,
    issued_at: '2026-11-18T08:00:00Z',
    expires_at: '2027-11-18T08:00:00Z',
  },
  {
    id: 'badge-2',
    qr_code: 'VIS-20002',
    entity_type: 'visitor',
    entity_name: 'Jane Guest',
    is_active: false,
    issued_at: '2026-11-19T09:00:00Z',
    expires_at: null,
  },
];

describe('BadgesRegistryClient', () => {
  const mockRevokeBadge = revokeBadgeCredential as jest.Mock;
  const mockToastSuccess = toast.success as jest.Mock;
  const mockToastError = toast.error as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders badges, Print Studio Link inside real Button asChild without Slot errors, and selects first badge', () => {
    render(
      <BadgesRegistryClient
        badges={SAMPLE_BADGES}
        page={1}
        totalPages={1}
        totalCount={2}
        pageSize={50}
      />
    );

    expect(screen.getByText('Active Provisioned Badges')).toBeInTheDocument();
    expect(screen.getAllByText('EMP-10001').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Thabo Mokoena').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Credential matrix for Thabo Mokoena')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code-section')).toHaveAttribute('data-qr', 'EMP-10001');
    expect(screen.getByText(/Issued:/)).toBeInTheDocument();
    expect(screen.getByText(/Expires:/)).toBeInTheDocument();

    const printLink = screen.getByRole('link', { name: /Print Studio/i });
    expect(printLink).toHaveAttribute('href', '/access-control/print-cards');
    expect(printLink).toHaveClass('inline-flex', 'border');

    const revokeButton = screen.getByRole('button', { name: /Revoke Badge/i });
    expect(revokeButton).toBeEnabled();
  });

  it('switches selected badge on row click and disables Revoke Badge for revoked badges', () => {
    render(
      <BadgesRegistryClient
        badges={SAMPLE_BADGES}
        page={1}
        totalPages={1}
        totalCount={2}
        pageSize={50}
      />
    );

    fireEvent.click(screen.getByText('Jane Guest'));

    expect(screen.getByText('Credential matrix for Jane Guest')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code-section')).toHaveAttribute('data-qr', 'VIS-20002');
    expect(screen.getByRole('button', { name: /Revoke Badge/i })).toBeDisabled();
  });

  it('revokes selected active badge and triggers success toast', async () => {
    mockRevokeBadge.mockResolvedValue({ success: true });

    render(
      <BadgesRegistryClient
        badges={SAMPLE_BADGES}
        page={1}
        totalPages={1}
        totalCount={2}
        pageSize={50}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Revoke Badge/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Revoke/i }));

    await waitFor(() => {
      expect(mockRevokeBadge).toHaveBeenCalledWith('badge-1');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Credential revoked', {
      description: 'EMP-10001 (Thabo Mokoena) has been deactivated.',
    });
  });

  it('surfaces error toast when badge revocation rejects with Error or unknown value', async () => {
    mockRevokeBadge.mockRejectedValueOnce(new Error('Permission denied'));

    render(
      <BadgesRegistryClient
        badges={SAMPLE_BADGES}
        page={1}
        totalPages={1}
        totalCount={2}
        pageSize={50}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Revoke Badge/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Revoke/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Revocation failed', {
        description: 'Permission denied',
      });
    });

    mockRevokeBadge.mockRejectedValueOnce('unknown-failure');
    fireEvent.click(screen.getByRole('button', { name: /Confirm Revoke/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Revocation failed', {
        description: 'Failed to revoke badge',
      });
    });
  });

  it('renders empty state cleanly without Slot errors and disables Revoke Badge', () => {
    render(
      <BadgesRegistryClient badges={[]} page={1} totalPages={0} totalCount={0} pageSize={50} />
    );

    expect(screen.getByText('No badges found for this department.')).toBeInTheDocument();
    expect(screen.getByText('Select Badge')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Print Studio/i })).toHaveAttribute(
      'href',
      '/access-control/print-cards'
    );
    expect(screen.getByRole('button', { name: /Revoke Badge/i })).toBeDisabled();
  });
});
