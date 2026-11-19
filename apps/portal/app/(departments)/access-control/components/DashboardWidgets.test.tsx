import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DashboardChartsRow from './DashboardChartsRow';
import DashboardKPIGrid from './DashboardKPIGrid';
import QRStatusDistributionChart from './QRStatusDistributionChart';

jest.mock('next/dynamic', () => () => {
  const MockChart = () => <div data-testid="dynamic-chart-stub" />;
  return MockChart;
});

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadialBarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="radial-bar-chart">{children}</div>
  ),
  RadialBar: () => <div data-testid="radial-bar" />,
  Tooltip: () => <div data-testid="chart-tooltip" />,
}));

describe('Access Control Dashboard Widgets', () => {
  it('renders DashboardKPIGrid with en-US formatted counts for active and zero values', () => {
    const { rerender } = render(
      <DashboardKPIGrid
        metrics={{
          activeQrCodes: 1250,
          expiringSoon: 12,
          deniedToday: 3,
          accessEventsToday: 2450,
          expiredAssigned: 4,
          entityCoverage: 95,
        }}
      />
    );

    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('1,250 active')).toBeInTheDocument();
    expect(screen.getByText('2,450')).toBeInTheDocument();
    expect(screen.getByText('2,450 logged')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();

    rerender(
      <DashboardKPIGrid
        metrics={{
          activeQrCodes: 0,
          expiringSoon: 0,
          deniedToday: 0,
          accessEventsToday: 0,
          expiredAssigned: 0,
          entityCoverage: 80,
        }}
      />
    );

    expect(screen.getByText('None expiring')).toBeInTheDocument();
    expect(screen.getByText('Zero denied')).toBeInTheDocument();
    expect(screen.getByText('All cleared')).toBeInTheDocument();
  });

  it('renders DashboardChartsRow and QRStatusDistributionChart with en-US numbers', () => {
    const distribution = [
      { name: 'Active', value: 1200, fill: '#10b981' },
      { name: 'Expired', value: 50, fill: '#ef4444' },
    ];

    render(
      <DashboardChartsRow
        hourlyStats={[{ hour: '08:00', granted: 40, denied: 2 }]}
        distribution={distribution}
      />
    );
    expect(screen.getByText(/1,250 registered QR codes/i)).toBeInTheDocument();

    render(<QRStatusDistributionChart data={distribution} />);
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });
});
