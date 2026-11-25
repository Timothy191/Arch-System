import '@testing-library/jest-dom';
import type { Department } from '@repo/departments/data-access';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HubLiveTelemetryPulse } from './HubLiveTelemetryPulse';

const sampleDepartments: Department[] = [
  {
    name: 'drilling',
    displayName: 'Drilling Operations',
    route: '/drilling',
    icon: 'Pickaxe',
    description: 'Drilling telemetry',
    color: 'blue',
    type: 'standard',
    status: 'active',
    stats: { label: 'Penetration', value: '1,240m' },
    trend: [72, 78, 84, 88, 91],
    actions: [],
  },
  {
    name: 'production',
    displayName: 'Production',
    route: '/production',
    icon: 'TrendingUp',
    description: 'Coal extraction',
    color: 'emerald',
    type: 'standard',
    status: 'maintenance',
    stats: { label: 'Yield', value: '86%' },
    trend: [80, 82, 85, 86, 84],
    actions: [],
  },
];

describe('HubLiveTelemetryPulse', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders live system feed banner and animated telemetry graph', () => {
    render(<HubLiveTelemetryPulse departments={sampleDepartments} />);

    expect(screen.getByTestId('hub-system-updates-banner')).toBeInTheDocument();
    expect(screen.getByText('LIVE SYSTEM FEED')).toBeInTheDocument();
    expect(screen.getByText(/Sweep #1/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Live operational telemetry trend chart' })
    ).toBeInTheDocument();
  });

  it('automatically rebuilds graph cycles over time and supports manual rebuild & mode switch', () => {
    render(<HubLiveTelemetryPulse departments={sampleDepartments} />);

    expect(screen.getByText(/Sweep #1/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(4600);
    });

    expect(screen.getByText(/Sweep #2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Module Readiness' }));
    expect(screen.getByTestId('hub-graph-focus-readout')).toHaveTextContent('% health');

    fireEvent.click(screen.getByLabelText('Rebuild graph now'));
    expect(screen.getByText(/Sweep #3/i)).toBeInTheDocument();
  });

  it('pauses and resumes rebuild timers and navigates banner updates', () => {
    render(<HubLiveTelemetryPulse departments={sampleDepartments} />);

    fireEvent.click(screen.getByLabelText('Next system update'));
    fireEvent.click(screen.getByLabelText('Previous system update'));

    fireEvent.click(screen.getByLabelText('Pause live graph rebuild'));
    expect(screen.getByLabelText('Resume live graph rebuild')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/Sweep #1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Resume live graph rebuild'));
    act(() => {
      jest.advanceTimersByTime(4600);
    });
    expect(screen.getByText(/Sweep #2/i)).toBeInTheDocument();
  });
});
