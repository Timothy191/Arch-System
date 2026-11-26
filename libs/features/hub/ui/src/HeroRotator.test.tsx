import type { Department } from '@repo/departments/data-access';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    trend: [1180, 1210, 1240],
    actions: [
      { label: 'View Logs', href: '/drilling/drilling-operations' },
      { label: 'Reports', href: '/drilling/reports' },
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
    trend: [82, 84, 85],
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

  it('jumps to the target slide when an indicator button is clicked', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    const jumpToProduction = screen.getByLabelText('Jump to Production');
    expect(jumpToProduction).toBeInTheDocument();
    expect(jumpToProduction.querySelector('svg')).toBeInTheDocument();

    fireEvent.click(jumpToProduction);
    expect(screen.getByLabelText('3 of 3: Production')).toHaveAttribute('aria-hidden', 'false');
  });

  it('renders Previous/Next buttons outside the card without a play/pause button', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    expect(screen.getByLabelText('Previous highlight')).toBeInTheDocument();
    expect(screen.getByLabelText('Next highlight')).toBeInTheDocument();
    expect(screen.getByTestId('hero-bottom-golden-separator')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pause auto rotation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Resume auto rotation')).not.toBeInTheDocument();
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

  it('omits Sector-01 and Nominal badges when all counts are zero', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);
    expect(screen.queryByText('Sector-01')).not.toBeInTheDocument();
    expect(screen.queryByText('Nominal')).not.toBeInTheDocument();
  });

  it('renders department icons and Arch logo nodes only for panels with recorded telemetry', () => {
    const { container } = render(<HeroRotator {...baseProps} departments={mockDepartments} />);

    // Department icons on hero cards with circular gold branding and Arch System gold Logo SVG
    const centralIcon = screen.getByTestId('hero-dept-icon-central-command');
    const drillingIcon = screen.getByTestId('hero-dept-icon-drilling');
    const productionIcon = screen.getByTestId('hero-dept-icon-production');
    expect(centralIcon).toBeInTheDocument();
    expect(centralIcon).toHaveClass('rounded-full', 'gold-steel-border', 'gold-steel-border-slim');
    expect(drillingIcon).toHaveClass('rounded-full', 'gold-steel-border', 'gold-steel-border-slim');
    expect(productionIcon).toHaveClass(
      'rounded-full',
      'gold-steel-border',
      'gold-steel-border-slim'
    );
    expect(centralIcon.querySelector('svg')).toHaveAttribute(
      'viewBox',
      '22.75 16.625 166.16 166.19'
    );
    expect(drillingIcon.querySelector('svg')).toHaveAttribute(
      'viewBox',
      '22.75 16.625 166.16 166.19'
    );
    expect(productionIcon.querySelector('svg')).toHaveAttribute(
      'viewBox',
      '22.75 16.625 166.16 166.19'
    );

    // Active Site Pins globe banner has been removed from HeroRotator
    expect(screen.queryByTestId('hero-kpi-slim-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Site Pins/i)).not.toBeInTheDocument();

    // Primary and secondary hero CTAs have gold bordering
    const secondaryCtas = container.querySelectorAll('[data-cta="secondary-hero"]');
    expect(secondaryCtas.length).toBeGreaterThan(0);
    for (const cta of Array.from(secondaryCtas)) {
      expect(cta).toHaveClass('gold-steel-border', 'gold-steel-border-slim');
    }

    // Small Arch-System logo icons on telemetry graphs instead of circle dots or nested <svg>
    const archNodes = screen.getAllByTestId('hero-graph-arch-node');
    expect(archNodes).toHaveLength(6);
    expect(
      container.querySelectorAll('[data-testid^="hero-telemetry-graph-"] circle')
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('[data-testid^="hero-telemetry-graph-"] svg svg')
    ).toHaveLength(0);

    // Header separators are present on every hero card; no fabricated graph separators.
    expect(screen.queryByTestId('hero-graph-separator-central-command')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-header-separator-central-command')).toBeInTheDocument();
    expect(screen.getByTestId('hero-header-separator-drilling')).toBeInTheDocument();
    expect(screen.getByTestId('hero-header-separator-production')).toBeInTheDocument();

    // Only the active center slide renders <video>; inactive preview slides render lightweight poster <img>
    const overviewVideo = screen.getByTestId('hero-video-central-command');
    expect(overviewVideo).toHaveAttribute('src', '/images/departments/overview.mp4');
    expect(overviewVideo).toHaveProperty('loop', true);
    expect(screen.queryByTestId('hero-video-drilling')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-video-production')).not.toBeInTheDocument();
    const drillingPoster = screen.getByTestId('hero-poster-drilling');
    const productionPoster = screen.getByTestId('hero-poster-production');
    expect(drillingPoster).toHaveAttribute('src', '/images/departments/drilling.webp');
    expect(drillingPoster).toHaveAttribute('decoding', 'async');
    expect(productionPoster).toHaveAttribute('src', '/images/departments/production.webp');
    expect(productionPoster).toHaveAttribute('decoding', 'async');
    expect(container.querySelectorAll('.gold-steel-border').length).toBeGreaterThanOrEqual(3);

    // Advancing to Drilling mounts its <video> and demotes Central Command to poster <img>
    fireEvent.click(screen.getByLabelText('Next highlight'));
    expect(screen.getByTestId('hero-video-drilling')).toHaveAttribute(
      'src',
      '/images/departments/drilling.mp4'
    );
    expect(screen.queryByTestId('hero-video-central-command')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-poster-central-command')).toBeInTheDocument();
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

    // Right slide (index 1 - Drilling): angled away right, scale(0.86), opacity 0.78, z-index 20
    expect(slides[1]).toHaveStyle({
      transform: 'translate3d(58%, 0, -140px) rotateY(-26deg) scale(0.86)',
      opacity: '0.78',
      zIndex: '20',
    });
    expect(slides[1].style.filter).toBe('');

    // Left slide (index 2 - Production): angled away left, scale(0.86), opacity 0.78, z-index 20
    expect(slides[2]).toHaveStyle({
      transform: 'translate3d(-58%, 0, -140px) rotateY(26deg) scale(0.86)',
      opacity: '0.78',
      zIndex: '20',
    });
    expect(slides[2].style.filter).toBe('');
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

  it('renders recorded telemetry only and an explicit unavailable state when no trend exists', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);

    expect(screen.getByTestId('hero-telemetry-graph-central-command')).toBeInTheDocument();
    expect(screen.getByTestId('hero-telemetry-graph-drilling')).toBeInTheDocument();
    expect(screen.getByTestId('hero-telemetry-graph-production')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('hero-telemetry-graph-central-command')).getByTestId(
        'hero-telemetry-unavailable'
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('hero-telemetry-graph-drilling')).queryByTestId(
        'hero-telemetry-unavailable'
      )
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('hero-telemetry-graph-production')).queryByTestId(
        'hero-telemetry-unavailable'
      )
    ).not.toBeInTheDocument();

    expect(screen.getAllByText('System Overview Trend').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Depth Trend').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Yield Trend').length).toBeGreaterThan(0);

    // Only panels with at least two real trend points render an SVG graph.
    expect(screen.getAllByTestId('hero-graph-x-axis')).toHaveLength(2);
    expect(screen.getAllByTestId('hero-graph-y-axis')).toHaveLength(2);

    // Fabricated video/telemetry HUD badges must not reappear.
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
    expect(screen.queryByText('30 FPS')).not.toBeInTheDocument();
    expect(screen.queryByText('1080p')).not.toBeInTheDocument();
    expect(screen.queryByText(/SHIFT START/)).not.toBeInTheDocument();
  });

  it('renders the recorded Plant & Processing stat and an explicit unavailable trend', () => {
    const plantDept: Department = {
      name: 'plant-processing',
      displayName: 'Plant & Processing',
      route: '/plant-processing',
      icon: 'Factory',
      description:
        'Coal wash plant operations, dense media separation, crusher throughput & yield telemetry',
      color: 'amber',
      type: 'standard',
      status: 'active',
      stats: { label: 'Plant Yield', value: '91.4%' },
      actions: [
        { label: 'Daily Log', href: '/plant-processing/daily-log' },
        { label: 'Reports', href: '/plant-processing/reports' },
      ],
    };

    render(<HeroRotator {...baseProps} departments={[plantDept]} />);
    expect(screen.getByText('Plant & Processing')).toBeInTheDocument();
    const telemetry = screen.getByTestId('hero-telemetry-graph-plant-processing');
    expect(telemetry).toBeInTheDocument();
    expect(within(telemetry).getByText('Plant Yield Trend')).toBeInTheDocument();
    expect(within(telemetry).getByText('91.4%')).toBeInTheDocument();
    expect(within(telemetry).getByText('Trend data unavailable')).toBeInTheDocument();
  });

  it('renders the recorded Plant Inventory stat and an explicit unavailable trend', () => {
    const plantInventoryDept: Department = {
      name: 'plant-inventory',
      displayName: 'Plant Inventory',
      route: '/plant-inventory',
      icon: 'Database',
      description:
        'ROM & clean coal stockpiles, magnetite medium inventory, reagents, spares & consumables tracking',
      color: 'emerald',
      type: 'standard',
      status: 'active',
      stats: { label: 'Stockpile', value: '48,200t' },
      actions: [
        { label: 'Inventory List', href: '/plant-inventory/daily-log' },
        { label: 'Stock Required', href: '/plant-inventory/history' },
      ],
    };

    render(<HeroRotator {...baseProps} departments={[plantInventoryDept]} />);
    expect(screen.getByText('Plant Inventory')).toBeInTheDocument();
    // Rotate to the Plant Inventory slide and verify its telemetry graph mounts.
    fireEvent.click(screen.getByRole('button', { name: 'Next highlight' }));
    expect(screen.queryByTestId('hero-kpi-slim-banner')).not.toBeInTheDocument();
    const telemetry = screen.getByTestId('hero-telemetry-graph-plant-inventory');
    expect(telemetry).toBeInTheDocument();
    expect(within(telemetry).getByText('Stockpile Trend')).toBeInTheDocument();
    expect(within(telemetry).getByText('48,200t')).toBeInTheDocument();
    expect(within(telemetry).getByText('Trend data unavailable')).toBeInTheDocument();
  });

  it('applies the display face (font-anurati) to all hero-card panel headers and Gold branding to Previous/Next highlight buttons', () => {
    render(<HeroRotator {...baseProps} departments={mockDepartments} />);

    const overviewHeading = screen.getByRole('heading', { name: 'System Overview', hidden: true });
    const drillingHeading = screen.getByRole('heading', {
      name: 'Drilling Operations',
      hidden: true,
    });
    const productionHeading = screen.getByRole('heading', { name: 'Production', hidden: true });

    expect(overviewHeading).toHaveClass('font-anurati');
    expect(drillingHeading).toHaveClass('font-anurati');
    expect(productionHeading).toHaveClass('font-anurati');

    const prevBtn = screen.getByLabelText('Previous highlight');
    const nextBtn = screen.getByLabelText('Next highlight');
    expect(prevBtn).toHaveClass(
      'border-0',
      'bg-transparent',
      'shadow-none',
      'text-accent-gold',
      'hover:text-accent-gold-hover'
    );
    expect(prevBtn).not.toHaveClass('rounded-full', 'gold-steel-border');
    expect(nextBtn).toHaveClass(
      'border-0',
      'bg-transparent',
      'shadow-none',
      'text-accent-gold',
      'hover:text-accent-gold-hover'
    );
    expect(nextBtn).not.toHaveClass('rounded-full', 'gold-steel-border');

    // Assert separator under each hero card header
    expect(screen.getByTestId('hero-header-separator-central-command')).toBeInTheDocument();
    expect(screen.getByTestId('hero-header-separator-drilling')).toBeInTheDocument();
    expect(screen.getByTestId('hero-header-separator-production')).toBeInTheDocument();

    const activeIndicator = screen.getByLabelText('Jump to System Overview');
    const inactiveIndicator = screen.getByLabelText('Jump to Drilling Operations');
    expect(activeIndicator).toHaveClass(
      'opacity-100',
      'visible',
      'scale-120',
      'text-accent-gold',
      'brightness-110'
    );
    expect(inactiveIndicator).toHaveClass('opacity-0', 'invisible');
    expect(activeIndicator.querySelector('svg')).toHaveClass(
      'w-5.5',
      'h-5.5',
      'opacity-100',
      'visible',
      'motion-safe:animate-pulse'
    );
    expect(inactiveIndicator.querySelector('svg')).toHaveClass(
      'w-4',
      'h-4',
      'opacity-0',
      'invisible'
    );
  });

  it('renders the dedicated mp4 video, poster, and recorded availability stat', () => {
    const availabilityDept: Department = {
      name: 'availability-utilization',
      displayName: 'Availability & Utilization',
      route: '/availability-utilization',
      icon: 'Activity',
      description: 'Fleet mechanical availability and equipment utilization',
      color: 'blue',
      type: 'standard',
      status: 'active',
      stats: { label: 'Availability', value: '94.6%' },
    };

    render(<HeroRotator {...baseProps} departments={[availabilityDept]} />);

    expect(screen.getByTestId('hero-poster-availability-utilization')).toHaveAttribute(
      'src',
      '/images/departments/availability-utilization.webp'
    );
    expect(screen.queryByTestId('hero-video-availability-utilization')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next highlight'));
    const video = screen.getByTestId('hero-video-availability-utilization');
    expect(video).toHaveAttribute('src', '/images/departments/availability-utilization.mp4');
    expect(video).toHaveAttribute('poster', '/images/departments/availability-utilization.webp');
    const telemetry = screen.getByTestId('hero-telemetry-graph-availability-utilization');
    expect(within(telemetry).getByText('Availability Trend')).toBeInTheDocument();
    expect(within(telemetry).getByText('94.6%')).toBeInTheDocument();
    expect(within(telemetry).getByText('Trend data unavailable')).toBeInTheDocument();
  });

  it('aliases presentation hero video and poster to overview media', () => {
    const presentationDept: Department = {
      name: 'presentation',
      displayName: 'Presentation',
      route: '/presentation',
      icon: 'Presentation',
      description: 'CEO and investor presentation deck',
      color: 'amber',
      type: 'standard',
      status: 'active',
      stats: { label: 'Briefing', value: '12 Slides' },
    };

    render(<HeroRotator {...baseProps} departments={[presentationDept]} />);

    expect(screen.getByTestId('hero-poster-presentation')).toHaveAttribute(
      'src',
      '/images/departments/overview.webp'
    );
    expect(screen.queryByTestId('hero-video-presentation')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next highlight'));
    const video = screen.getByTestId('hero-video-presentation');
    expect(video).toHaveAttribute('src', '/images/departments/overview.mp4');
    expect(video).toHaveAttribute('poster', '/images/departments/overview.webp');
    expect(screen.getByTestId('hero-dept-icon-presentation')).toBeInTheDocument();
    expect(screen.getByText('CEO and investor presentation deck')).toBeInTheDocument();
  });

  it('renders recorded stats without inventing HUD metadata or graph axes', () => {
    const extraDepts: Department[] = [
      {
        name: 'office',
        displayName: 'Office',
        route: '/office',
        icon: 'Briefcase',
        description: 'Enterprise AI Office suite (GenOffice) for metallurgical cost modeling',
        color: 'amber',
        type: 'standard',
        status: 'active',
        stats: { label: 'Workspace', value: 'GenOffice AI' },
      },
      {
        name: 'database',
        displayName: 'Database',
        route: '/database',
        icon: 'Database',
        description: 'Cross-department PostgreSQL 17 registry and schema governance',
        color: 'emerald',
        type: 'standard',
        status: 'active',
        stats: { label: 'Queries/s', value: '342' },
      },
      {
        name: 'overview',
        displayName: 'System Overview',
        route: '/overview',
        icon: 'Activity',
        description: 'System topology, architectural maps and live audit compliance',
        color: 'blue',
        type: 'standard',
        status: 'active',
        stats: { label: 'Score', value: '100%' },
      },
    ];

    const { container } = render(<HeroRotator {...baseProps} departments={extraDepts} />);

    // The overview panel has no real telemetry, so it must state that explicitly.
    expect(screen.getByText('Metric:')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('hero-telemetry-graph-central-command')).getByText(
        'Trend data unavailable'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(baseProps.defaultDescription)).toHaveClass('line-clamp-2');

    // None of these panels has a real trend series, so no graph axes are invented.
    expect(container.querySelectorAll('svg[aria-label*="recorded trend"]')).toHaveLength(0);
    expect(screen.queryAllByTestId('hero-graph-y-axis')).toHaveLength(0);
    expect(screen.queryAllByTestId('hero-graph-x-axis')).toHaveLength(0);

    // Advance to office -> only the real department stat is rendered.
    fireEvent.click(screen.getByLabelText('Next highlight'));
    const officeTelemetry = screen.getByTestId('hero-telemetry-graph-office');
    expect(within(officeTelemetry).getByText('Workspace Trend')).toBeInTheDocument();
    expect(within(officeTelemetry).getByText('GenOffice AI')).toBeInTheDocument();

    // Advance to database -> only the real department stat is rendered.
    fireEvent.click(screen.getByLabelText('Next highlight'));
    expect(screen.getByTestId('hero-telemetry-graph-database')).toBeInTheDocument();

    // Advance to the duplicate overview panel -> no fabricated topology health claim is rendered.
    fireEvent.click(screen.getByLabelText('Next highlight'));
    expect(screen.getByTestId('hero-telemetry-graph-overview')).toBeInTheDocument();
    expect(screen.queryByText(/Topology Health/)).not.toBeInTheDocument();
  });
});
