import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getProvisioningReferenceData } from '@/actions/employee-provisioning';
import { getDepartmentContext } from '~/lib/dept-context';
import { assertAccessControlRole } from '../actions/shared';
import ExpiredCredentialsPage from './page';

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/actions/employee-provisioning', () => ({
  getProvisioningReferenceData: jest.fn(),
}));

jest.mock('@/components/employee/EmployeeProvisioningModal', () => ({
  EmployeeProvisioningModal: ({ triggerLabel }: { triggerLabel: string }) => (
    <button type="button">{triggerLabel}</button>
  ),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock('../actions/shared', () => ({
  assertAccessControlRole: jest.fn(),
}));

jest.mock('../badges/BadgesRegistryClient', () => ({
  BadgesRegistryClient: ({
    badges,
    totalCount,
  }: {
    badges: ReadonlyArray<{ id: string; entity_name: string }>;
    totalCount: number;
  }) => (
    <div data-testid="expired-badges-registry" data-count={totalCount}>
      {badges.map((b) => (
        <span key={b.id}>{b.entity_name}</span>
      ))}
    </div>
  ),
}));

describe('/access-control/expired Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDepartmentContext as jest.Mock).mockResolvedValue({
      deptId: 'dept-access-1',
    });
    (getProvisioningReferenceData as jest.Mock).mockResolvedValue({
      departments: [{ id: 'dept-1', name: 'access-control', display_name: 'Access Control' }],
    });

    const pastIso = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const soonIso = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const farIso = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();

    const sampleBadges = [
      {
        id: 'b-expired',
        qr_code: 'EMP-EXP-01',
        entity_type: 'personnel',
        is_active: true,
        issued_at: '2025-01-01T00:00:00Z',
        expires_at: pastIso,
        personnel: { first_name: 'Expired', surname: 'Operator' },
        visitor: null,
        fleet: null,
        equipment: null,
      },
      {
        id: 'b-soon',
        qr_code: 'EMP-SOON-02',
        entity_type: 'visitor',
        is_active: true,
        issued_at: '2026-01-01T00:00:00Z',
        expires_at: soonIso,
        personnel: null,
        visitor: { first_name: 'Expiring', surname: 'Visitor' },
        fleet: null,
        equipment: null,
      },
      {
        id: 'b-far',
        qr_code: 'FLT-OK-03',
        entity_type: 'fleet',
        is_active: true,
        issued_at: '2026-01-01T00:00:00Z',
        expires_at: farIso,
        personnel: null,
        visitor: null,
        fleet: { fleet_code: 'DT-77', vehicle_type: 'Haul Truck' },
        equipment: null,
      },
    ];

    (assertAccessControlRole as jest.Mock).mockResolvedValue({
      supabase: {
        from: jest.fn(() => {
          let lteCutoff: string | null = null;
          let isHead = false;
          const chain: Record<string, unknown> = {
            select: jest.fn((_cols: string, opts?: { head?: boolean }) => {
              isHead = Boolean(opts?.head);
              return chain;
            }),
            eq: jest.fn(() => chain),
            not: jest.fn(() => chain),
            lte: jest.fn((_col: string, val: string) => {
              lteCutoff = val;
              return chain;
            }),
            order: jest.fn(() => chain),
            range: jest.fn(() => chain),
            then: (onFulfilled: (val: unknown) => unknown) => {
              const filtered = lteCutoff
                ? sampleBadges.filter((b) => b.expires_at <= lteCutoff!)
                : sampleBadges;
              return Promise.resolve({
                data: isHead ? null : filtered,
                count: filtered.length,
                error: null,
              }).then(onFulfilled);
            },
          };
          return chain;
        }),
      },
    });
  });

  it('defaults to expired filter and renders window counts linking to /access-control/expired', async () => {
    const jsx = await ExpiredCredentialsPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText('Expired Credentials')).toBeInTheDocument();
    expect(screen.getByTestId('expired-badges-registry')).toHaveAttribute('data-count', '1');
    expect(screen.getByText('Expired Operator')).toBeInTheDocument();
    expect(screen.queryByText('Expiring Visitor')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'ALL (3)' })).toHaveAttribute(
      'href',
      '/access-control/expired?filter=all'
    );
    expect(screen.getByRole('link', { name: 'EXPIRED (1)' })).toHaveAttribute(
      'href',
      '/access-control/expired?filter=expired'
    );
    expect(screen.getByRole('link', { name: '30D (2)' })).toHaveAttribute(
      'href',
      '/access-control/expired?filter=30d'
    );
  });

  it('shows all badges with expiry dates when filter=all is active', async () => {
    const jsx = await ExpiredCredentialsPage({
      searchParams: Promise.resolve({ filter: 'all' }),
    });
    render(jsx);

    expect(screen.getByTestId('expired-badges-registry')).toHaveAttribute('data-count', '3');
    expect(screen.getByText('DT-77 (Haul Truck)')).toBeInTheDocument();
  });
});
