import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import DatabaseError from './error';
import DatabaseLayout from './layout';
import DatabaseLoading from './loading';
import DatabaseDashboardPage from './page';

const mockFrom = jest.fn();
const mockCreateReadReplicaClient = jest.fn();

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: () => mockCreateReadReplicaClient(),
}));

jest.mock('@repo/ui', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  usePathname: jest.fn(() => '/database'),
}));

jest.mock('@/components/nav/ActiveDepartmentSetter', () => ({
  ActiveDepartmentSetter: ({ department }: { department: string | null }) => (
    <div data-testid="active-dept-setter" data-dept={department ?? ''} />
  ),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

describe('Database Admin Department Route Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DatabaseDashboardPage (page.tsx)', () => {
    it('renders live connected badge and aggregated row counts when read replica queries succeed', async () => {
      mockFrom.mockImplementation((tableName: string) => ({
        select: jest.fn(async () => ({
          count: tableName === 'departments' ? 12 : 10,
          error: null,
        })),
      }));
      mockCreateReadReplicaClient.mockResolvedValue({
        from: (tableName: string) => mockFrom(tableName),
      });

      const jsx = await DatabaseDashboardPage();
      render(jsx);

      expect(screen.getByText('Supabase PostgreSQL 17 Operations Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Supabase Live Connected')).toBeInTheDocument();
      expect(screen.getByText('SUPABASE CLUSTER METRICS')).toBeInTheDocument();
      expect(screen.getByText('122')).toBeInTheDocument();
      expect(screen.getByText('Migration #186')).toBeInTheDocument();
      expect(screen.getByTestId('redis-insight-workbench-card')).toBeInTheDocument();
      expect(screen.getByText('Open RedisInsight (:5540)')).toBeInTheDocument();
      expect(screen.getByText('drilling:telemetry:stream')).toBeInTheDocument();
    });

    it('degrades gracefully to Supabase Standby when read replica connection throws or fails', async () => {
      mockCreateReadReplicaClient.mockRejectedValue(new Error('Replica offline'));

      const jsx = await DatabaseDashboardPage();
      render(jsx);

      expect(screen.getByText('Supabase Standby')).toBeInTheDocument();
      expect(screen.getByText('Standby')).toBeInTheDocument();
    });
  });

  describe('DatabaseLayout (layout.tsx)', () => {
    it('renders ActiveDepartmentSetter and DepartmentLayout for database department', async () => {
      const jsx = await DatabaseLayout({
        children: <div data-testid="db-child">Database Child Content</div>,
      });
      render(jsx);

      expect(screen.getByTestId('active-dept-setter')).toHaveAttribute('data-dept', 'database');
      expect(screen.getByTestId('db-child')).toBeInTheDocument();
    });
  });

  describe('DatabaseLoading (loading.tsx)', () => {
    it('renders an accessible skeleton loader with aria-busy and cluster metric placeholders', () => {
      const { container } = render(<DatabaseLoading />);

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('aria-busy', 'true');
      expect(root).toHaveAttribute('aria-label', 'Loading database operations');
      expect(screen.getByText('SUPABASE CLUSTER METRICS')).toBeInTheDocument();
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(5);
    });
  });

  describe('DatabaseError (error.tsx)', () => {
    it('renders Database Error heading and calls reset handler when Try again is clicked', () => {
      const resetMock = jest.fn();
      const testError = new Error('Connection pool exhausted');

      render(<DatabaseError error={testError} reset={resetMock} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Database Error')).toBeInTheDocument();
      expect(screen.getByText('Connection pool exhausted')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
      expect(resetMock).toHaveBeenCalledTimes(1);
    });
  });
});
