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

    const logoSvg = heading.querySelector('span.rounded-full > svg');
    expect(logoSvg).toBeInTheDocument();
    expect(logoSvg).toHaveAttribute('viewBox', '22.75 16.625 166.16 166.19');

    expect(screen.getByLabelText('Pin Administration')).toBeInTheDocument();
    expect(screen.getByLabelText('Pin Stock Control Department')).toBeInTheDocument();
    expect(screen.getAllByTestId('arch-bookmark-icon')).toHaveLength(2);
    expect(heading).toHaveClass('gold-steel-border', 'gold-steel-border-slim');
    expect(screen.getByTestId('core-modules-count-badge')).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim'
    );
    expect(screen.getByRole('link', { name: /Executive Dashboard/i })).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim'
    );
    expect(screen.getByLabelText('Search operational modules')).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim'
    );
    expect(screen.getByRole('group', { name: 'Filter modules by category' })).toHaveClass(
      'gold-steel-border',
      'gold-steel-border-slim'
    );
    expect(screen.getByTestId('core-modules-header-separator')).toBeInTheDocument();
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
