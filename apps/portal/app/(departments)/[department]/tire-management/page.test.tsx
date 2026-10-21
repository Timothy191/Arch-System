import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TireManagementPage from './page';

// Mock department context
jest.mock('~/lib/dept-context', () => ({
  requireDepartment: jest.fn(),
  getDepartmentContext: jest.fn().mockResolvedValue({
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'tires') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 't1',
                  serial_number: 'TIRE-001',
                  brand: 'Michelin',
                  size: '59/80R63',
                  position: 'Front Left',
                  status: 'installed',
                  installed_at: '2026-01-01',
                  installed_hours: 1200,
                  machines: { id: 'm1', name: 'DT-01', serial_number: 'SN-01' },
                },
                {
                  id: 't2',
                  serial_number: 'TIRE-002',
                  brand: 'Bridgestone',
                  size: '59/80R63',
                  position: 'Front Right',
                  status: 'installed',
                  installed_at: '2026-01-01',
                  installed_hours: 1500,
                  machines: { id: 'm1', name: 'DT-01', serial_number: 'SN-01' },
                },
                {
                  id: 't3',
                  serial_number: 'TIRE-003',
                  brand: 'Goodyear',
                  size: '59/80R63',
                  position: null,
                  status: 'inventory',
                  installed_at: null,
                  installed_hours: 0,
                  machines: null,
                },
              ],
            }),
          };
        }
        if (table === 'tire_inspections') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'i1',
                  tire_id: 't1',
                  inspection_date: '2026-03-01',
                  tread_depth_mm: 12, // Critical low tread < 15
                  pressure_psi: 105,
                  condition_status: 'normal',
                  notes: 'Low tread depth',
                },
                {
                  id: 'i2',
                  tire_id: 't2',
                  inspection_date: '2026-03-01',
                  tread_depth_mm: 35,
                  pressure_psi: 110,
                  condition_status: 'normal',
                  notes: 'Good',
                },
              ],
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [] }),
        };
      }),
    },
  }),
}));

describe('TireManagementPage', () => {
  it('renders tire management page with single-pass metric aggregations correctly', async () => {
    const jsx = await TireManagementPage({
      params: Promise.resolve({ department: 'engineering' }),
    });
    render(jsx);

    expect(screen.getByText('Tire Management')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Total tires
    expect(screen.getByText('2')).toBeInTheDocument(); // Installed active
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Inventory / Spares and Critical alerts

    expect(screen.getByText('TIRE-001')).toBeInTheDocument();
    expect(screen.getByText('TIRE-002')).toBeInTheDocument();
    expect(screen.getByText('TIRE-003')).toBeInTheDocument();
  });
});
