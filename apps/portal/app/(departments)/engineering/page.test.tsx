import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import EngineeringError from './error';
import EngineeringLayout from './layout';
import EngineeringLoading from './loading';
import EngineeringDashboardPage from './page';

const mockFrom = jest.fn();

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(async () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(async () => ({
    deptId: 'dept-engineering-001',
    department: 'engineering',
  })),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  usePathname: jest.fn(() => '/engineering'),
}));

jest.mock('@/components/nav/ActiveDepartmentSetter', () => ({
  ActiveDepartmentSetter: ({ department }: { department: string | null }) => (
    <div data-testid="active-dept-setter" data-dept={department ?? ''} />
  ),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

describe('Engineering Department Route Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EngineeringDashboardPage (page.tsx)', () => {
    it('renders active and resolved breakdown counts along with recent breakdowns list', async () => {
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex += 1;
        if (callIndex === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({ count: 4, error: null })),
          };
        }
        if (callIndex === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn(async () => ({ count: 7, error: null })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: [
              {
                id: 'bd-1',
                machine_name: 'CAT 797F #12',
                reason: 'Hydraulic pump pressure fault',
                priority: 'critical',
                created_at: '2026-10-22T04:00:00Z',
              },
              {
                id: 'bd-2',
                machine_name: 'Komatsu PC8000 #03',
                reason: 'Track tension sensor warning',
                priority: 'high',
                created_at: '2026-10-22T03:00:00Z',
              },
              {
                id: 'bd-3',
                machine_name: '',
                reason: 'Scheduled inspection',
                priority: '',
                created_at: '2026-10-22T02:00:00Z',
              },
            ],
            error: null,
          })),
        };
      });

      const jsx = await EngineeringDashboardPage();
      render(jsx);

      expect(screen.getByText('Engineering Hub')).toBeInTheDocument();
      expect(screen.getByText('FLEET HEALTH & TELEMETRY')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('CAT 797F #12')).toBeInTheDocument();
      expect(screen.getByText('Komatsu PC8000 #03')).toBeInTheDocument();
      expect(screen.getByText('Unknown Machine')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('normal')).toBeInTheDocument();
    });

    it('gracefully falls back to zero counts and hides recent active list when queries return null', async () => {
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex += 1;
        if (callIndex === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({ count: null, error: null })),
          };
        }
        if (callIndex === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn(async () => ({ count: null, error: null })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({ data: null, error: null })),
        };
      });

      const jsx = await EngineeringDashboardPage();
      render(jsx);

      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('Recent Active')).not.toBeInTheDocument();
    });
  });

  describe('EngineeringLayout (layout.tsx)', () => {
    it('renders the ActiveDepartmentSetter and DepartmentLayout with engineering tabs', async () => {
      const jsx = await EngineeringLayout({
        children: <div data-testid="eng-child">Engineering Child Content</div>,
      });
      render(jsx);

      expect(screen.getByTestId('active-dept-setter')).toHaveAttribute('data-dept', 'engineering');
      expect(screen.getByTestId('eng-child')).toBeInTheDocument();
      expect(screen.getAllByText(/Engineering/i).length).toBeGreaterThan(0);
    });
  });

  describe('EngineeringLoading (loading.tsx)', () => {
    it('renders an accessible skeleton loader with aria-busy and light-mode tokens', () => {
      const { container } = render(<EngineeringLoading />);

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('aria-busy', 'true');
      expect(root).toHaveAttribute('aria-label', 'Loading engineering');
      expect(container.querySelectorAll('.animate-pulse').length).toBe(4);
    });
  });

  describe('EngineeringError (error.tsx)', () => {
    it('renders the error fallback alert and invokes reset when Try again is clicked', () => {
      const resetMock = jest.fn();
      const testError = new Error('Simulated engineering telemetry failure');

      render(<EngineeringError error={testError} reset={resetMock} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Engineering Error')).toBeInTheDocument();
      expect(screen.getByText('Simulated engineering telemetry failure')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
      expect(resetMock).toHaveBeenCalledTimes(1);
    });
  });
});
