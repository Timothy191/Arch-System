import type { Department } from '@repo/departments/data-access';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeroRotator } from './HeroRotator';

// AGENT-TRACE: HeroRotator uses framer-motion MotionValue physics + motion.div.
// Mock framer-motion so tests run in jsdom without an animation loop. MotionValues
// become tiny plain objects; motion.* renders as the underlying DOM element.
type MV = { get: () => number; set: (v: number) => void; onChange: () => () => void };

function _makeMotionValue(initial: number): MV {
  let value = initial;
  const listeners = new Set<(v: number) => void>();
  return {
    get: () => value,
    set: (v: number) => {
      value = v;
      listeners.forEach((fn) => fn(value));
    },
    onChange: (fn: (v: number) => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

jest.mock('@repo/ui/ThreeHeroRotatorDynamic', () => ({
  ThreeHeroRotatorDynamic: (props: any) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { ThreeHeroRotator } = jest.requireActual('@repo/ui/ThreeHeroRotator');
    return React.createElement(ThreeHeroRotator, props);
  },
}));

jest.mock('@react-three/fiber', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    Canvas: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'r3f-canvas' }, children),
    useFrame: jest.fn(),
  };
});

jest.mock('@react-three/drei', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    Html: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'r3f-html' }, children),
  };
});

// Removed TrustLogos mock since it's now in @repo/ui
const baseProps = {
  defaultTitle: 'System Overview',
  defaultDescription: 'Top-level mining operations command center',
  primaryHref: '/overview',
  primaryLabel: 'Overview',
  secondaryHref: '/overview?tab=audit',
  secondaryLabel: 'Audit Reports',
};

const mockDepartments: Department[] = [
  {
    name: 'drilling',
    displayName: 'Drilling Operations',
    route: '/drilling',
    icon: 'Pickaxe',
    description: 'Drill rig operations & bit depth telemetry',
    color: 'blue',
    type: 'standard',
    status: 'active',
    stats: { label: 'Depth', value: '1,240m' },
    actions: [
      { label: 'View Logs', href: '/drilling/drilling-operations' },
      { label: 'Telemetry', href: '/drilling/machine-telemetry' },
    ],
  },
  {
    name: 'production',
    displayName: 'Production',
    route: '/production',
    icon: 'TrendingUp',
    description: 'Coal yield, tonnage & extraction tracking',
    color: 'emerald',
    type: 'standard',
    status: 'active',
    stats: { label: 'Yield', value: '85%' },
    actions: [
      { label: 'Daily Log', href: '/production/daily-log' },
      { label: 'Reports', href: '/production/reports' },
    ],
  },
];

describe('HeroRotator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the overview panel plus all department panels', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);

    expect(screen.getByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('Drilling Operations')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
    // Overview is the first/active slide → its CTAs are present
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Audit Reports')).toBeInTheDocument();
  });

  it('marks the active slide as visible and hides inactive slides from a11y tree', () => {
    const { container } = render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const slides = container.querySelectorAll('[role="group"]');
    expect(slides).toHaveLength(3);
    // First slide is active
    expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    expect(slides[1].getAttribute('aria-hidden')).toBe('true');
    expect(slides[2].getAttribute('aria-hidden')).toBe('true');
  });

  it('removes inactive CTA links from the tab order', () => {
    const { container } = render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const primaryCtas = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-cta="primary-hero"]')
    );
    expect(primaryCtas).toHaveLength(3);
    expect(primaryCtas[0]).toHaveAttribute('tabindex', '0');
    expect(primaryCtas[1]).toHaveAttribute('tabindex', '-1');
    expect(primaryCtas[2]).toHaveAttribute('tabindex', '-1');
  });

  it('advances the active slide when the Next button is clicked', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const nextBtn = screen.getByLabelText('Next highlight');

    // Initially overview is active
    expect(screen.getAllByText('System Overview')[0]).toBeInTheDocument();

    fireEvent.click(nextBtn);
    // Drilling is now active (second slide)
    expect(screen.getByLabelText('2 of 3: Drilling Operations')).toHaveAttribute(
      'aria-hidden',
      'false'
    );
  });

  it('retreats the active slide when the Previous button is clicked', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const prevBtn = screen.getByLabelText('Previous highlight');

    fireEvent.click(prevBtn);
    // Wrapped to the last slide (Production)
    expect(screen.getByLabelText('3 of 3: Production')).toHaveAttribute('aria-hidden', 'false');
  });

  it('jumps to the target slide when a dot indicator is clicked', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const jumpToProduction = screen.getByLabelText('Jump to Production');

    fireEvent.click(jumpToProduction);
    expect(screen.getByLabelText('3 of 3: Production')).toHaveAttribute('aria-hidden', 'false');
  });

  it('toggles manual pause state via the play/pause button', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const pauseBtn = screen.getByLabelText('Pause auto rotation');
    expect(pauseBtn).toBeInTheDocument();

    fireEvent.click(pauseBtn);
    expect(screen.getByLabelText('Resume auto rotation')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Resume auto rotation'));
    expect(screen.getByLabelText('Pause auto rotation')).toBeInTheDocument();
  });

  it('renders operational urgency badges when counts are non-zero', () => {
    render(
      <HeroRotator
        {...baseProps}
        departments={mockDepartments}
        incidentCount={2}
        breakdownCount={1}
        offlineMachineCount={3}
      />
    );
    // Badges render once per slide; assert at least one is present.
    expect(screen.getAllByText('2 Open').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 Breakdown').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 Offline').length).toBeGreaterThan(0);
  });

  it('renders a Nominal badge when all counts are zero', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    expect(screen.getAllByText('Nominal').length).toBeGreaterThan(0);
  });

  it('does not render the control HUD when there is only one panel', () => {
    render(<HeroRotator {...baseProps} departments={[]} />);
    expect(screen.queryByLabelText('Next highlight')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Previous highlight')).not.toBeInTheDocument();
  });

  it('configures 3D perspective container and applies cover-flow transforms to slides', () => {
    const { container } = render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const perspectiveContainer = container.querySelector('[style*="perspective"]');
    expect(perspectiveContainer).toBeInTheDocument();
    expect(perspectiveContainer).toHaveStyle({
      perspective: '1400px',
      transformStyle: 'preserve-3d',
    });

    const slides = container.querySelectorAll<HTMLElement>('[role="group"]');
    expect(slides).toHaveLength(3);

    // Active slide (index 0 - Overview): center, scale(1), full opacity, z-index 30
    expect(slides[0]).toHaveStyle({
      transform: 'translate3d(0%, 0, 0) rotateY(0deg) scale(1)',
      opacity: '1',
      zIndex: '30',
    });

    // Right slide (index 1 - Drilling): angled away right, scale(0.86), opacity 0.42, z-index 10
    expect(slides[1]).toHaveStyle({
      transform: 'translate3d(58%, 0, -140px) rotateY(-26deg) scale(0.86)',
      opacity: '0.42',
      zIndex: '10',
    });

    // Left slide (index 2 - Production): angled away left, scale(0.86), opacity 0.42, z-index 10
    expect(slides[2]).toHaveStyle({
      transform: 'translate3d(-58%, 0, -140px) rotateY(26deg) scale(0.86)',
      opacity: '0.42',
      zIndex: '10',
    });
  });

  it('activates slide when clicking adjacent preview flank panels', () => {
    const { container } = render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const slides = container.querySelectorAll<HTMLElement>('[role="group"]');

    // Initially Overview (0) is active
    expect(slides[0].getAttribute('aria-hidden')).toBe('false');

    // Click right flank preview panel (Drilling Operations)
    fireEvent.click(slides[1]);
    expect(screen.getByLabelText('2 of 3: Drilling Operations')).toHaveAttribute(
      'aria-hidden',
      'false'
    );

    // Click left flank preview panel (Overview)
    fireEvent.click(slides[0]);
    expect(screen.getByLabelText('1 of 3: System Overview')).toHaveAttribute(
      'aria-hidden',
      'false'
    );
  });

  it('renders authentic telemetry bus badges and live video HUD overlays', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);

    // Assert live video HUD overlays on the active card
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('30 FPS')).toBeInTheDocument();
    expect(screen.getByText('1080p')).toBeInTheDocument();

    // Assert telemetry bus heading and live protocol badges
    expect(screen.getByText(/SYSTEM DIAGNOSTICS & TELEMETRY BUS/i)).toBeInTheDocument();
    expect(screen.getByText('Modbus TCP Active')).toBeInTheDocument();
    expect(screen.getByText('CAN-Bus 250kbps')).toBeInTheDocument();
    expect(screen.getByText('Latency: 14ms')).toBeInTheDocument();
    expect(screen.getByText('ISO 27001')).toBeInTheDocument();
  });
});
