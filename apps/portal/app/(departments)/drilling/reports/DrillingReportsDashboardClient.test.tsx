import { render, screen } from '@testing-library/react';
import React from 'react';
import { DrillingReportsDashboardClient } from './DrillingReportsDashboardClient';

// Mock UI components that might interfere with unit testing
jest.mock('@repo/ui/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('@repo/ui/Input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/features/analytics/components/ExportButton', () => ({
  ExportButton: () => <button type="button">Export</button>,
}));

jest.mock('@/features/analytics/components/PDFDownloadButton', () => ({
  PDFDownloadButton: () => <button type="button">PDF Download</button>,
}));

const sampleOperations = [
  {
    id: '1',
    operation_date: '2025-02-01',
    shift_type: 'Day',
    machine_name: 'DR001',
    operator_name: 'John Doe',
    site: 'North Pit',
    block_drilled: 'Block A',
    meters_drilled: 150,
    holes: 10,
    total_hours: 8,
    production_delays: 15,
    non_productional_delays: 10,
    engineering_delays: 5,
    status: 'completed',
    shift_target_meters: 200,
    created_at: '2025-02-01T08:00:00Z',
  },
  {
    id: '2',
    operation_date: '2025-02-01',
    shift_type: 'Night',
    machine_name: 'DR002',
    operator_name: 'Jane Smith',
    site: 'South Pit',
    block_drilled: 'Block B',
    meters_drilled: 250,
    holes: 20,
    total_hours: 10,
    production_delays: 20,
    non_productional_delays: 5,
    engineering_delays: 0,
    status: 'completed',
    shift_target_meters: 200,
    created_at: '2025-02-01T20:00:00Z',
  },
];

describe('DrillingReportsDashboardClient', () => {
  const defaultProps = {
    departmentId: 'dept-drilling',
    departmentSlug: 'drilling',
    departmentName: 'Drilling',
    todayStr: '2025-02-01',
    currentShift: 'day' as const,
    fromDateStr: '2025-02-01',
    toDateStr: '2025-02-01',
    operations: sampleOperations,
    drillRigNames: ['DR001', 'DR002'],
    csvContent: 'col1,col2\nval1,val2',
  };

  it('renders correctly and computes single-pass KPI totals accurately', () => {
    render(<DrillingReportsDashboardClient {...defaultProps} />);

    // Total meters: 150 + 250 = 400.0m
    expect(screen.getByText('400.0m')).toBeInTheDocument();

    // Day: 150m / Night: 250m breakdown text
    expect(screen.getByText('Day: 150m')).toBeInTheDocument();
    expect(screen.getByText('Night: 250m')).toBeInTheDocument();

    // Total shift logs count (2 shift records)
    expect(screen.getByText(/2 shift records/i)).toBeInTheDocument();
  });

  it('renders empty state when no operations match filters', () => {
    render(<DrillingReportsDashboardClient {...defaultProps} operations={[]} />);

    expect(screen.getByText(/No drill rig logs found/i)).toBeInTheDocument();
  });
});
