import { render, screen } from '@testing-library/react';
import { type EngineeringNote, EngineeringNotesList } from './EngineeringNotesList';

// Mock UI components if necessary
jest.mock('@repo/ui/AnimatedList', () => ({
  AutoAnimateList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

describe('EngineeringNotesList', () => {
  const mockNotes: EngineeringNote[] = [
    {
      id: 'note-1',
      shift_type: 'day',
      issue_type: 'mechanical',
      severity: 'critical',
      machine_id: 'm-1',
      description: 'Hydraulic pump overheating',
      action_taken: 'Replaced hydraulic fluid filter',
      requires_follow_up: true,
      status: 'open',
      created_at: '2026-03-30T08:30:00Z',
      source: 'engineering_note',
      machine: {
        name: 'EX-01',
        sites: { name: 'North Pit' },
      },
    },
    {
      id: 'note-2',
      shift_type: 'night',
      issue_type: 'breakdown',
      severity: 'high',
      machine_id: 'm-2',
      description: 'Engine failure on haul truck',
      action_taken: 'Towed to workshop',
      requires_follow_up: false,
      status: 'resolved',
      created_at: '2026-03-30T20:15:00Z',
      source: 'breakdown',
      machine: {
        name: 'DT-05',
        sites: [{ name: 'South Pit' }],
      },
    },
  ];

  it('renders empty state when no notes are provided', () => {
    render(<EngineeringNotesList notes={[]} />);
    expect(
      screen.getByText('No engineering issues, breakdowns, or activities logged today.')
    ).toBeInTheDocument();
  });

  it('renders notes grouped by day shift and night shift', () => {
    render(<EngineeringNotesList notes={mockNotes} />);

    expect(screen.getByText('Day Shift')).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();

    expect(screen.getByText('Hydraulic pump overheating')).toBeInTheDocument();
    expect(screen.getByText('Engine failure on haul truck')).toBeInTheDocument();

    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('North Pit')).toBeInTheDocument();

    expect(screen.getByText('DT-05')).toBeInTheDocument();
    expect(screen.getByText('South Pit')).toBeInTheDocument();
  });
});
