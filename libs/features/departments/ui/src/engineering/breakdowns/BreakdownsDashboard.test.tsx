import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { BreakdownsDashboard } from './BreakdownsDashboard';
import type { Breakdown, BreakdownMetrics, Machine } from './types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImg({ src, alt }: { src: string; alt: string }) {
    return <img src={src} alt={alt} />;
  },
}));

jest.mock('./actions', () => ({
  createBreakdown: jest.fn(),
  bookOutBreakdown: jest.fn(),
  directCheckout: jest.fn(),
}));

const METRICS: BreakdownMetrics = {
  total: 75,
  active: 0,
  completedToday: 2,
  avgRepairHours: 3.4,
};

const MACHINES: Machine[] = [
  {
    id: 'm-1',
    name: 'BD-26',
    machine_type: 'Dozer',
    serial_number: 'Caterpillar D9R',
    manufacturer: 'Caterpillar',
    starting_smr: 28445,
    current_smu: 28445,
    image_url: '/images/fleet/caterpillar-dozer.webp',
    site_name: 'Extension Pit',
    site_code: 'EXT-PIT',
    active: true,
  },
];

const COMPLETED_BREAKDOWN: Breakdown = {
  id: 'b-1',
  department_id: 'dept-eng',
  fleet_id: 'BD-26',
  machine_name: 'BD-26',
  machine_type: 'Dozer',
  date_in: '2026-11-26',
  time_in: '08:00',
  date_out: '2026-11-26',
  time_out: '11:30',
  reason: 'Hydraulic Hose Leak / Burst',
  repair_notes: 'Replaced hose',
  status: 'completed',
  missing_book_in: false,
  created_by: 'emp-1',
  completed_by: 'emp-1',
  deleted_at: null,
  created_at: '2026-11-26T08:00:00Z',
  updated_at: '2026-11-26T11:30:00Z',
};

describe('BreakdownsDashboard design feedback compliance', () => {
  it('removes AI Diagnostics, Active Breakdowns h3, and No records found empty state', () => {
    render(
      <BreakdownsDashboard
        departmentId="dept-eng"
        breakdowns={[COMPLETED_BREAKDOWN]}
        metrics={METRICS}
        machines={MACHINES}
      />
    );

    expect(screen.getByRole('heading', { name: 'Breakdown Management' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /AI Diagnostics/i })).not.toBeInTheDocument();
    expect(screen.queryByText('AI Diagnostics')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Active Breakdowns' })).not.toBeInTheDocument();
    expect(screen.queryByText('No records found.')).not.toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Book In/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Book Out/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Query Data/i })).toBeInTheDocument();
  });

  it('opens and switches interactive animated header panels when header items are selected', () => {
    render(
      <BreakdownsDashboard
        departmentId="dept-eng"
        breakdowns={[COMPLETED_BREAKDOWN]}
        metrics={METRICS}
        machines={MACHINES}
      />
    );

    expect(screen.queryByTestId('breakdown-header-pulse-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fleet Health Pulse/i }));
    expect(screen.getByTestId('breakdown-header-pulse-panel')).toBeInTheDocument();
    expect(screen.getByText(/100% Available/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /SLA Configuration/i }));
    expect(screen.getByTestId('breakdown-header-sla-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '6h SLA' }));
    expect(screen.getByText(/vs 6h target SLA/i)).toBeInTheDocument();
  });
});
