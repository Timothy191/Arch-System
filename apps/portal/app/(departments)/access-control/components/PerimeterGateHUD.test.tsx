import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { type PerimeterGate, triggerGatePulse } from '../actions';
import { PerimeterGateHUD } from './PerimeterGateHUD';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  })),
}));

jest.mock('@repo/shared/hooks', () => ({
  useSupabaseRealtime: jest.fn(({ onInsert }) => {
    mockOnInsertCallback = onInsert;
    return { status: 'SUBSCRIBED', error: null };
  }),
}));

let mockOnInsertCallback: ((record: Record<string, unknown>) => void) | undefined;

jest.mock('../actions', () => ({
  triggerGatePulse: jest.fn().mockResolvedValue({ message: 'Barrier pulsed successfully' }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const sampleGates: PerimeterGate[] = [
  {
    id: 'GATE-01-NORTH',
    name: 'Main North Inbound Boom Barrier',
    type: 'boom_barrier',
    zone: 'Perimeter Access Road',
    status: 'ONLINE',
    mode: 'Auto-Pulse',
    cycleCountToday: 342,
    lastEventTime: '1 min ago',
    lastEntityPassed: 'CAT 777D Haul Truck #14',
    interlockActive: false,
  },
  {
    id: 'VAULT-05-MAG',
    name: 'Explosives Magazine Gate',
    type: 'mantrap',
    zone: 'Magazine Vault',
    status: 'INTERLOCK_ARMED',
    mode: 'Zero-Tolerance BAC',
    cycleCountToday: 45,
    lastEventTime: '4 min ago',
    lastEntityPassed: 'Blaster Crew #2',
    interlockActive: true,
  },
];

describe('PerimeterGateHUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders gate cycle throughput and barrier readiness graphs alongside gate cards', () => {
    render(<PerimeterGateHUD initialGates={sampleGates} />);

    expect(screen.getByTestId('perimeter-hud-graphs')).toBeInTheDocument();
    expect(screen.getByText('Gate Cycle Throughput Today')).toBeInTheDocument();
    expect(screen.getByText('Barrier & BAC Readiness')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Perimeter gate cycle throughput graph' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Perimeter readiness radial chart' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2/2 Online')).toBeInTheDocument();

    act(() => {
      mockOnInsertCallback?.({ gate_location: 'Main Gate', badge_id: 'badge-12345678' });
    });
    expect(screen.getAllByText('343').length).toBeGreaterThanOrEqual(1);
  });

  it('triggers remote barrier pulse when Pulse Barrier button is clicked', async () => {
    render(<PerimeterGateHUD initialGates={sampleGates} />);

    const pulseButtons = screen.getAllByRole('button', { name: /Log Gate Override/i });
    fireEvent.click(pulseButtons[0]!);

    await waitFor(() => {
      expect(triggerGatePulse).toHaveBeenCalledWith(
        'Main North Inbound Boom Barrier',
        expect.stringContaining('GATE-01-NORTH')
      );
      expect(toast.success).toHaveBeenCalledWith('Barrier pulsed successfully');
    });
  });
});
