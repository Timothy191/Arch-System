import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { updateExcavatorAssignmentConfig } from '../hourly-loads/actions';
import { ExcavatorActivityForm } from './ExcavatorActivityForm';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

jest.mock('@repo/shared/hooks', () => ({
  useSupabaseRealtime: jest.fn(),
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({})),
}));

jest.mock('../hourly-loads/actions', () => ({
  updateExcavatorAssignmentConfig: jest.fn().mockResolvedValue({ success: true }),
}));

describe('ExcavatorActivityForm', () => {
  const mockProps = {
    departmentId: 'dept-1',
    excavators: [
      {
        id: 'ex-10',
        name: 'EX-10',
        machine_type: 'Excavator',
        serial_number: 'Hitachi 400',
        site_id: 'site-1',
      },
    ],
    dumpers: [
      {
        id: 'dt-01',
        name: 'DT-01',
        machine_type: 'Dump Truck',
        bin_factor: 25,
        site_id: 'site-1',
      },
    ],
    sites: [
      { id: 'site-1', name: 'Main Pit', site_code: 'PIT-01' },
      { id: 'site-2', name: 'North Pit', site_code: 'NP-01' },
    ],
    mineBlocks: [
      { id: 'blk-1', name: 'Block 101', code: '101', site_id: 'site-1' },
      { id: 'blk-2', name: 'Block 202', code: '202', site_id: 'site-2' },
    ],
    todayDumperLoads: [
      {
        id: 'load-1',
        machine_id: 'dt-01',
        excavator_id: 'ex-10',
        material_type: 'Waste',
        shift_type: 'day' as const,
        is_locked: false,
        total_loads: 6,
      },
    ],
    todayActivities: [],
    todayAssignments: [],
    today: '2026-10-23',
    initialShift: 'day' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Excavator Location, Block Mined & Material Mapping panel and active machines', () => {
    render(<ExcavatorActivityForm {...mockProps} />);

    expect(
      screen.getByRole('heading', {
        name: /Excavator Location, Block Mined & Material Mapping/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('EX-10')).toBeInTheDocument();
    expect(screen.getByText('Active: DT-01')).toBeInTheDocument();
  });

  it('persists excavator site and material changes via updateExcavatorAssignmentConfig', async () => {
    render(<ExcavatorActivityForm {...mockProps} />);

    const siteSelect = screen.getByLabelText('Select Site / Location for EX-10');
    fireEvent.change(siteSelect, { target: { value: 'site-2' } });

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-1',
          excavatorId: 'ex-10',
          loadDate: '2026-10-23',
          shiftType: 'day',
          siteId: 'site-2',
          blockMinedId: 'blk-2',
        })
      );
    });

    const coalBtn = screen.getByRole('button', { name: 'Coal' });
    fireEvent.click(coalBtn);

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-1',
          excavatorId: 'ex-10',
          materialType: 'Coal',
        })
      );
    });
  });
});
