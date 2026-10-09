import { render, screen, fireEvent } from '@testing-library/react';
import { MusterRollCallView } from './muster-roll-call-view';
import type { MusterSummary } from '../actions';

// Mock dependencies
jest.mock('@repo/shared/hooks', () => ({
  usePitConnectivity: () => ({ isOnline: true }),
  useOfflineQueue: () => ({ enqueue: jest.fn(), queue: [], isSyncing: false }),
}));

jest.mock('../actions', () => ({
  markPersonnelMusterStatus: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSummary: MusterSummary = {
  totalSoulsOnSite: 3,
  accountedCount: 1,
  unaccountedCount: 1,
  evacuatedCount: 1,
  blastStatus: 'ALL_CLEAR',
  musterStations: [
    {
      id: 'MS-1',
      name: 'Station Alpha',
      location: 'North Gate',
      count: 1,
      targetZone: 'Zone A',
    },
    {
      id: 'MS-2',
      name: 'Station Beta',
      location: 'South Gate',
      count: 0,
      targetZone: 'Zone B',
    },
  ],
  records: [
    {
      id: 'p-1',
      entityType: 'personnel',
      name: 'John Doe',
      company: 'Mining Co',
      roleOrPurpose: 'Operator',
      assignedZone: 'Zone A',
      lastSeenTime: '08:00',
      lastSeenGate: 'North Gate',
      status: 'accounted',
      station: 'Station Alpha',
      checkedOffAt: '08:05',
      inductionValid: true,
      medicalValid: true,
    },
    {
      id: 'p-2',
      entityType: 'personnel',
      name: 'Jane Smith',
      company: 'Mining Co',
      roleOrPurpose: 'Engineer',
      assignedZone: 'Zone B',
      lastSeenTime: '08:10',
      lastSeenGate: 'South Gate',
      status: 'unaccounted',
      station: null,
      checkedOffAt: null,
      inductionValid: true,
      medicalValid: true,
    },
    {
      id: 'p-3',
      entityType: 'visitor',
      name: 'Bob Wilson',
      company: 'Contractor Corp',
      roleOrPurpose: 'Inspector',
      assignedZone: 'Zone A',
      lastSeenTime: '08:15',
      lastSeenGate: 'Main Gate',
      status: 'evacuated',
      station: null,
      checkedOffAt: null,
      inductionValid: false,
      medicalValid: true,
    },
  ],
};

describe('MusterRollCallView', () => {
  it('renders summary metrics and station counts correctly', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    // Total souls
    expect(screen.getByText('3')).toBeInTheDocument();
    // Verification % calculation: (1 / 3) * 100 = 33%
    expect(screen.getByText('33% Verified at Stations')).toBeInTheDocument();

    // Station Alpha should show 1 Verified from single-pass stationCounts computation
    expect(screen.getAllByText('Station Alpha').length).toBeGreaterThan(0);
    expect(screen.getByText('1 Verified')).toBeInTheDocument();

    // Station Beta should show 0 Verified
    expect(screen.getByText('Station Beta')).toBeInTheDocument();
    expect(screen.getByText('0 Verified')).toBeInTheDocument();
  });

  it('filters records by search query', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    const searchInput = screen.getByPlaceholderText(/Search name, contractor, zone.../i);

    fireEvent.change(searchInput, { target: { value: 'Jane' } });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
  });

  it('filters records by status tab', () => {
    render(<MusterRollCallView initialSummary={mockSummary} />);

    const unaccountedBtn = screen.getByRole('button', { name: /Unaccounted \(1\)/i });
    fireEvent.click(unaccountedBtn);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});
