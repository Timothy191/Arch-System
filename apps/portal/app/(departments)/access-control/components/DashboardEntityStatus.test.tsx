import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DashboardEntityStatus from './DashboardEntityStatus';

describe('DashboardEntityStatus', () => {
  const mockEntityStatus = [
    {
      type: 'Employees',
      total: 100,
      active: 85,
      expiring: 10,
      expired: 5,
    },
    {
      type: 'Vehicles',
      total: 50,
      active: 40,
      expiring: 5,
      expired: 5,
    },
    {
      type: 'Equipment',
      total: 20,
      active: 15,
      expiring: 3,
      expired: 2,
    },
  ];

  it('renders entity rows with correct totals and percentages', () => {
    render(<DashboardEntityStatus entityStatus={mockEntityStatus} />);

    expect(screen.getByText('Entity QR Status')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('100 total')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();

    expect(screen.getByText('Vehicles')).toBeInTheDocument();
    expect(screen.getByText('50 total')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();

    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('20 total')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('correctly aggregates active, expiring, and expired summary totals', () => {
    render(<DashboardEntityStatus entityStatus={mockEntityStatus} />);

    // Total active = 85 + 40 + 15 = 140
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.getByText('Total Active')).toBeInTheDocument();

    // Total expiring = 10 + 5 + 3 = 18
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Expiring')).toBeInTheDocument();

    // Total expired = 5 + 5 + 2 = 12
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
