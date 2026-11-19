import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { requireDepartment } from '~/lib/dept-context';
import RollOverPage from './page';

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('@repo/departments/ui', () => ({
  DozerRollForm: ({ departmentId, today }: { departmentId: string; today: string }) => (
    <div data-testid="dozer-roll-form" data-dept={departmentId} data-today={today} />
  ),
}));

const mockRolls = [
  {
    id: 'roll-1',
    machine_id: 'dozer-1',
    shift_type: 'day',
    blade_passes: 1200,
    push_count: 1500,
    hours_operated: 8,
    area_covered_sqm: 450,
    machine: { name: 'D11 Dozer #1', site_id: 'site-1', sites: [{ name: 'Brakfontein Pit' }] },
    operator: { full_name: 'S. Ndlovu' },
  },
];

const mockOps = [
  {
    id: 'op-2',
    machine_id: 'dozer-2',
    shift_type: 'night',
    hours_worked: 6,
    start_smu: 100,
    end_smu: 106,
    machine: { name: 'D9 Dozer #2', site_id: 'site-1', sites: [{ name: 'Brakfontein Pit' }] },
    operator: { full_name: 'B. Khumalo' },
    site: { name: 'Brakfontein Pit' },
  },
];

jest.mock('~/lib/dept-context', () => ({
  requireDepartment: jest.fn((dept: string, allowed: string) => {
    if (dept !== allowed) throw new Error('NEXT_NOT_FOUND');
  }),
  getDepartmentContext: jest.fn(async () => ({
    deptId: 'dept-cr-01',
    today: '2026-11-19',
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn(async () => ({
              data: [
                {
                  id: 'dozer-1',
                  name: 'D11 Dozer #1',
                  serial_number: 'D11-01',
                  site_id: 'site-1',
                  sites: { name: 'Brakfontein Pit' },
                },
              ],
            })),
          };
        }
        if (table === 'dozer_rolls') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValue({
              eq: jest.fn(async () => ({ data: mockRolls })),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn(async () => ({ data: mockOps })),
            }),
          }),
        };
      }),
    },
  })),
}));

describe('RollOverPage (/control-room/roll-over)', () => {
  it('enforces control-room department and renders en-US BCM, passes, and push counts', async () => {
    await expect(
      RollOverPage({ params: Promise.resolve({ department: 'drilling' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    const jsx = await RollOverPage({ params: Promise.resolve({ department: 'control-room' }) });
    render(jsx);

    expect(requireDepartment).toHaveBeenCalledWith('control-room', 'control-room');
    expect(screen.getByText('Roll Over (Dozers)')).toBeInTheDocument();
    expect(screen.getByTestId('dozer-roll-form')).toBeInTheDocument();
    // 14 hours * 250 = 3,500 BCM; 1,200 passes; 1,500 pushes
    expect(screen.getByText('3,500 BCM')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getAllByText('1,500').length).toBeGreaterThan(0);
    expect(screen.getByText('Roll-over: 2,000 BCM')).toBeInTheDocument();
  });
});
