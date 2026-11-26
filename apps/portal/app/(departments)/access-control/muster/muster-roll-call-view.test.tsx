import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { MusterSummary } from '../actions';
import { MusterRollCallView } from './muster-roll-call-view';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({}),
}));

jest.mock('@repo/shared/hooks', () => ({
  usePitConnectivity: () => ({ isOnline: true }),
  useOfflineQueue: Object.assign(() => ({ enqueue: jest.fn(), queue: [], isSyncing: false }), {
    getState: () => ({ sync: jest.fn().mockResolvedValue(undefined) }),
  }),
  useSupabaseRealtime: jest.fn(),
}));

jest.mock('../actions', () => ({
  markPersonnelMusterStatus: jest.fn().mockResolvedValue({ success: true }),
}));

describe('MusterRollCallView', () => {
  const mockSummary: MusterSummary = {
    totalPersonnelOnSite: 3,
    accountedCount: 1,
    unaccountedCount: 1,
    evacuatedCount: 1,
    musterStations: [
      {
        id: 'ms-1',
        name: 'Muster Point Alpha',
        location: 'Pit North Gate',
        targetZone: 'Sector 1',
      },
      {
        id: 'ms-2',
        name: 'Muster Point Bravo',
        location: 'Plant Main Gate',
        targetZone: 'Sector 2',
      },
    ],
    records: [
      {
        id: 'rec-1',
        name: 'John Doe',
        entityType: 'personnel',
        company: 'Arch Mining',
        roleOrPurpose: 'Operator',
        assignedZone: 'Sector 1',
        status: 'accounted',
        lastSeenGate: 'North Gate',
        lastSeenTime: '08:00',
        inductionValid: true,
        station: 'Muster Point Alpha',
        checkedOffAt: '08:15',
      },
      {
        id: 'rec-2',
        name: 'Jane Smith',
        entityType: 'personnel',
        company: 'Contractor X',
        roleOrPurpose: 'Engineer',
        assignedZone: 'Sector 2',
        status: 'unaccounted',
        lastSeenGate: 'South Gate',
        lastSeenTime: '08:05',
        inductionValid: true,
        station: null,
        checkedOffAt: null,
      },
      {
        id: 'rec-3',
        name: 'Bob Johnson',
        entityType: 'visitor',
        company: 'Visitor Co',
        roleOrPurpose: 'Auditor',
        assignedZone: 'Admin',
        status: 'evacuated',
        lastSeenGate: 'Main Gate',
        lastSeenTime: '08:10',
        inductionValid: false,
        station: null,
        checkedOffAt: null,
      },
    ],
  };

  it('renders summary header and calculates live counts via memoized aggregation', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    expect(screen.getByText('On-Site Command HUD')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Total souls
    expect(screen.getByText('1 Verified')).toBeInTheDocument(); // Station count for Alpha
    expect(screen.queryByText('ALL SOULS ACCOUNTED')).not.toBeInTheDocument();

    expect(screen.getByTestId('muster-counter-total')).toHaveClass(
      'gold-steel-border',
      'shadow-xl'
    );
    expect(screen.getByTestId('muster-roll-call-table-container')).toHaveClass(
      'gold-steel-border',
      'bg-white'
    );
    expect(screen.getByTestId('muster-stations-grid').firstElementChild).toHaveClass(
      'gold-steel-border',
      'bg-white'
    );
  });

  it('omits ALL SOULS ACCOUNTED badge even when zero personnel are unaccounted and uses borderless default GlassCards', () => {
    const allAccountedSummary: MusterSummary = {
      ...mockSummary,
      unaccountedCount: 0,
      records: mockSummary.records.map((r) => ({ ...r, status: 'accounted' })),
    };

    const { container } = render(<MusterRollCallView initialSummary={allAccountedSummary} />);
    expect(screen.queryByText('ALL SOULS ACCOUNTED')).not.toBeInTheDocument();
    expect(container.querySelectorAll('span[class*="--mac-close"]')).toHaveLength(0);
  });

  it('filters personnel table when search input is typed', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search name, contractor, zone.../i);
    fireEvent.change(searchInput, { target: { value: 'Jane' } });

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('filters records when status filter buttons are clicked', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    const unaccountedButton = screen.getByRole('button', { name: /Unaccounted \(1\)/i });
    fireEvent.click(unaccountedButton);

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});
