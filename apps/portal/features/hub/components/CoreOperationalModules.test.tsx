import '@testing-library/jest-dom';
import type { Department } from '@repo/departments/data-access';
import { CookieConsent } from '@repo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ServiceWorkerRegister } from '@/app/ServiceWorkerRegister';
import { CoreOperationalModules } from './CoreOperationalModules';

jest.mock('@repo/ui/AnimatedList', () => ({
  AnimatedList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@repo/ui/HeroRotator', () => ({
  HeroRotator: () => <div data-testid="hero-rotator" />,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@/hooks/useClearanceNotification', () => ({
  useClearanceNotification: jest.fn(),
}));

const mockDepartments: Department[] = [
  {
    name: 'admin',
    displayName: 'Administration',
    route: '/admin',
    icon: 'ShieldCheck',
    description: 'Enterprise governance and access administration',
    color: 'blue',
    type: 'standard',
    status: 'active',
    stats: { label: 'Users', value: '124' },
    actions: [],
  },
  {
    name: 'plant-inventory',
    displayName: 'Stock Control Department',
    route: '/plant-inventory',
    icon: 'Package',
    description: 'Plant equipment stock control',
    color: 'emerald',
    type: 'standard',
    status: 'active',
    stats: { label: 'Equipment Stock Lines', value: '8' },
    actions: [],
  },
];

describe('CoreOperationalModules', () => {
  it('renders the Mining Department Modules heading with the Arch System Logo icon and department pin buttons', () => {
    render(<CoreOperationalModules departments={mockDepartments} canSeeExecutive={true} />);

    const heading = screen.getByRole('heading', { name: /Mining Department Modules/i });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('heading-crisp-ink', 'text-slate-950');
    const headingInitials = heading.querySelectorAll('span');
    expect(headingInitials).toHaveLength(3);
    expect(Array.from(headingInitials).map((el) => el.textContent)).toEqual(['M', 'D', 'M']);
    for (const initial of Array.from(headingInitials)) {
      expect(initial).toHaveClass('text-[1.35em]');
    }

    const banner = heading.closest('.gold-steel-border');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim',
      'bg-white/60',
      'backdrop-blur-xl',
      'border-white/40'
    );

    const logoBadge = banner?.querySelector('span.rounded-2xl');
    expect(logoBadge).toBeInTheDocument();
    expect(logoBadge).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim',
      'chip-elevated-3d',
      'shining'
    );

    const logoSvg = logoBadge?.querySelector('svg');
    expect(logoSvg).toBeInTheDocument();
    expect(logoSvg).toHaveAttribute('viewBox', '22.75 16.625 166.16 166.19');

    expect(screen.getByLabelText('Pin Administration')).toBeInTheDocument();
    expect(screen.getByLabelText('Pin Stock Control Department')).toBeInTheDocument();
    expect(screen.getAllByTestId('arch-bookmark-icon')).toHaveLength(2);
    expect(screen.queryByTestId('core-modules-count-badge')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Executive Dashboard/i })).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim'
    );
    expect(screen.getByLabelText('Search operational modules')).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim',
      'font-bold',
      'text-accent-gold'
    );
    expect(screen.getAllByText('Active')[0]?.parentElement).toHaveClass(
      'stat-chip-shine',
      'chip-elevated-3d',
      'shining',
      'bg-emerald-950',
      'text-white'
    );
    expect(screen.getByText('Pinned').parentElement).toHaveClass(
      'stat-chip-shine',
      'stat-chip-shine-delay-1',
      'chip-elevated-3d',
      'shining',
      'bg-amber-950',
      'text-amber-50'
    );
    expect(screen.getAllByText('Alerts')[0]?.parentElement).toHaveClass(
      'stat-chip-shine',
      'stat-chip-shine-delay-2',
      'chip-elevated-3d',
      'shining',
      'bg-rose-950',
      'text-white'
    );
    expect(screen.getByRole('button', { name: /^All$/i })).toHaveClass(
      'chip-elevated-3d',
      'shining'
    );
    expect(screen.getByRole('button', { name: /Active/i })).toHaveClass(
      'border-slate-500/80',
      'chip-elevated-3d',
      'shining'
    );
    expect(screen.getByRole('button', { name: /Alerts/i })).toHaveClass(
      'border-slate-500/80',
      'chip-elevated-3d',
      'shining'
    );
    expect(screen.getByRole('group', { name: 'Filter modules by category' })).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim',
      'chip-elevated-3d',
      'shining'
    );
    expect(screen.getByTestId('core-modules-header-separator')).toBeInTheDocument();
    expect(screen.getByTestId('core-modules-header-separator').querySelector('svg')).toHaveClass(
      'text-accent-gold'
    );
    expect(screen.queryByText('LIVE SYSTEM FEED')).not.toBeInTheDocument();
  });

  it('renders module card graphs with capped deltas and honest snapshots for counter arrays', () => {
    const withTrends: Department[] = [
      { ...mockDepartments[0]!, status: 'alert', trend: [18, 13, 9, 630] },
      { ...mockDepartments[1]!, trend: [18, 40, 90, 200, 400, 630] },
    ];
    render(<CoreOperationalModules departments={withTrends} />);

    expect(screen.getByTestId('dept-telemetry-snapshot-admin')).toBeInTheDocument();
    expect(screen.getByTestId('dept-trend-delta-plant-inventory')).toHaveTextContent('▲ 35×');
    expect(
      screen.getByRole('img', { name: /Stock Control Department 24-hour trend: up 35 times/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/3400/)).not.toBeInTheDocument();
  });

  describe('CookieConsent persistence & zero-flash behavior', () => {
    beforeEach(() => {
      localStorage.clear();
      // biome-ignore lint/suspicious/noDocumentCookie: clearing test cookie state
      document.cookie = 'arch_cookie_consent=; path=/; max-age=0';
    });

    it('persists declined state when clicking Decline Optional so popup does not reappear', () => {
      const { unmount } = render(<CookieConsent />);
      const declineBtn = screen.getByRole('button', { name: /Decline Optional/i });
      fireEvent.click(declineBtn);

      expect(localStorage.getItem('cookie_consent')).toBe('declined');
      expect(document.cookie).toContain('arch_cookie_consent=declined');
      expect(screen.queryByRole('button', { name: /Accept All/i })).not.toBeInTheDocument();

      unmount();
      render(<CookieConsent />);
      expect(screen.queryByRole('button', { name: /Accept All/i })).not.toBeInTheDocument();
    });

    it('persists accepted state when clicking Accept All', () => {
      render(<CookieConsent />);
      const acceptBtn = screen.getByRole('button', { name: /Accept All/i });
      fireEvent.click(acceptBtn);

      expect(localStorage.getItem('cookie_consent')).toBe('accepted');
      expect(document.cookie).toContain('arch_cookie_consent=accepted');
      expect(screen.queryByRole('button', { name: /Accept All/i })).not.toBeInTheDocument();
    });
  });

  describe('ServiceWorkerRegister adaptive client-side hardware scaling', () => {
    const originalHardwareConcurrency = navigator.hardwareConcurrency;

    afterEach(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        configurable: true,
        value: originalHardwareConcurrency,
      });
      delete document.documentElement.dataset.perfTier;
    });

    it('assigns lite tier on low-core devices and skips background warmup', () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        configurable: true,
        value: 2,
      });

      render(<ServiceWorkerRegister />);
      expect(document.documentElement.dataset.perfTier).toBe('lite');
    });

    it('assigns high tier on 8+ core / 8GB+ RAM systems', () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        configurable: true,
        value: 12,
      });
      Object.defineProperty(navigator, 'deviceMemory', {
        configurable: true,
        value: 16,
      });

      act(() => {
        render(<ServiceWorkerRegister />);
      });
      expect(document.documentElement.dataset.perfTier).toBe('high');
    });
  });
});
