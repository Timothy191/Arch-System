import { fireEvent, render, screen } from '@testing-library/react';
import type { MusterSummary } from '../actions';
import { MusterRollCallView } from './muster-roll-call-view';

jest.mock('@repo/shared/hooks', () => ({
  usePitConnectivity: () => ({ isOnline: true }),
  useOfflineQueue: () => ({ enqueue: jest.fn(), queue: [], isSyncing: false }),
}));

jest.mock('../actions', () => ({
  markPersonnelMusterStatus: jest.fn().mockResolvedValue({ success: true }),
}));

const mockSummary: MusterSummary = {
  records: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      entityType: 'personnel',
      name: 'John Doe',
      company: 'MiningCo',
      roleOrPurpose: 'Operator',
      assignedZone: 'Pit Alpha',
      status: 'accounted',
      station: 'Muster Station Alpha',
      checkedOffAt: '08:00',
      inductionValid: true,
      lastSeenGate: 'Gate 1',
      lastSeenTime: '07:45',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      entityType: 'contractor',
      name: 'Jane Smith',
      company: 'BuildCorp',
      roleOrPurpose: 'Engineer',
      assignedZone: 'Pit Beta',
      status: 'unaccounted',
      station: null,
      checkedOffAt: null,
      inductionValid: true,
      lastSeenGate: 'Gate 2',
      lastSeenTime: '07:50',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      entityType: 'personnel',
      name: 'Bob Marley',
      company: 'MiningCo',
      roleOrPurpose: 'Supervisor',
      assignedZone: 'Pit Alpha',
      status: 'evacuated',
      station: 'Muster Station Beta',
      checkedOffAt: '08:15',
      inductionValid: false,
      lastSeenGate: 'Gate 1',
      lastSeenTime: '08:10',
    },
  ],
  musterStations: [
    {
      id: 'MS-01',
      name: 'Muster Station Alpha',
      location: 'North Pit Gate',
      targetZone: 'Alpha',
    },
    {
      id: 'MS-02',
      name: 'Muster Station Beta',
      location: 'South Pit Gate',
      targetZone: 'Beta',
    },
  ],
};

describe('MusterRollCallView', () => {
  it('renders correctly and calculates live counts', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    expect(screen.getByText('Emergency Evacuation & Blast Clearance Station')).toBeInTheDocument();
    // Total souls: 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays accurate verified counts for muster stations', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    // Muster Station Alpha has 1 accounted record
    expect(screen.getByText('1 Verified')).toBeInTheDocument();
  });

  it('filters personnel records when searching', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    const searchInput = screen.getByPlaceholderText('Search name, contractor, zone...');
    fireEvent.change(searchInput, { target: { value: 'Jane' } });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('filters personnel records when clicking status filter buttons', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    // Click Unaccounted filter button
    const unaccountedButton = screen.getByRole('button', { name: /Unaccounted \(1\)/i });
    fireEvent.click(unaccountedButton);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});
