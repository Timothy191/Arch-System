import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MusterRollCallView } from './muster-roll-call-view';

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

const mockInitialSummary = {
  activeEvacuations: 1,
  totalPersonnelOnSite: 3,
  musterStations: [
    {
      id: 'MS-01',
      name: 'Muster Point Alpha',
      location: 'North Gate Yard',
      targetZone: 'Pit Alpha North',
      capacity: 50,
      currentCount: 1,
      status: 'active' as const,
    },
    {
      id: 'MS-02',
      name: 'Muster Point Bravo',
      location: 'South Pit Portal',
      targetZone: 'Pit Alpha South',
      capacity: 40,
      currentCount: 0,
      status: 'active' as const,
    },
  ],
  records: [
    {
      id: 'P001',
      name: 'John Doe',
      entityType: 'personnel' as const,
      company: 'Arch Mining',
      roleOrPurpose: 'Operator',
      assignedZone: 'North Pit',
      lastSeenGate: 'Main Gate',
      lastSeenTime: '08:00',
      status: 'accounted' as const,
      station: 'Muster Point Alpha',
      checkedOffAt: '08:15',
      inductionValid: true,
    },
    {
      id: 'P002',
      name: 'Jane Smith',
      entityType: 'personnel' as const,
      company: 'Contractor Ltd',
      roleOrPurpose: 'Engineer',
      assignedZone: 'South Pit',
      lastSeenGate: 'South Gate',
      lastSeenTime: '08:10',
      status: 'unaccounted' as const,
      station: null,
      checkedOffAt: null,
      inductionValid: true,
    },
    {
      id: 'P003',
      name: 'Bob Wilson',
      entityType: 'visitor' as const,
      company: 'Visitor Corp',
      roleOrPurpose: 'Auditor',
      assignedZone: 'Main Office',
      lastSeenGate: 'Main Gate',
      lastSeenTime: '08:20',
      status: 'evacuated' as const,
      station: null,
      checkedOffAt: null,
      inductionValid: false,
    },
  ],
};

describe('MusterRollCallView', () => {
  it('renders live counts and station counts correctly', () => {
    render(<MusterRollCallView initialSummary={mockInitialSummary} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument();

    // Verification of station headcount in UI
    expect(screen.getByText('1 Verified')).toBeInTheDocument();
  });

  it('filters records by search query and status filter', () => {
    render(<MusterRollCallView initialSummary={mockInitialSummary} />);

    // Filter unaccounted
    const unaccountedBtn = screen.getByRole('button', { name: /Unaccounted \(1\)/i });
    fireEvent.click(unaccountedBtn);

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Search query
    const searchInput = screen.getByPlaceholderText(/Search name, contractor, zone/i);
    fireEvent.change(searchInput, { target: { value: 'Smith' } });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});
