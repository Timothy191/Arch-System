import '@testing-library/jest-dom';
import type { Department } from '@repo/departments/data-access';
import { render, screen } from '@testing-library/react';
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
  it('renders the Core Operational Modules heading with the Arch System Logo icon and department pin buttons', () => {
    render(<CoreOperationalModules departments={mockDepartments} canSeeExecutive={true} />);

    const heading = screen.getByRole('heading', { name: /Core Operational Modules/i });
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
  });
});
