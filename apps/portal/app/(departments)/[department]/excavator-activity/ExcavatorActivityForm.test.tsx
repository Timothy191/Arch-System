import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { quickAddMineBlock, updateExcavatorAssignmentConfig } from '../hourly-loads/actions';
import { ExcavatorActivityForm } from './ExcavatorActivityForm';
import { ExcavatorActivityTelemetryOverview } from './ExcavatorActivityTelemetryOverview';

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
  quickAddMineBlock: jest.fn().mockResolvedValue({
    success: true,
    block: {
      id: 'blk-new',
      name: 'Brakfontein Pit Bench D',
      code: 'BLK-MAIN-BRAK-D',
      site_id: 'site-1',
    },
  }),
}));

describe('ExcavatorActivityForm & ExcavatorActivityTelemetryOverview', () => {
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

  it('renders Excavator Location, Block Mined & Material Mapping panel, golden separators, and active machines', () => {
    render(<ExcavatorActivityForm {...mockProps} />);

    expect(
      screen.getByRole('heading', {
        name: /Excavator Location, Block Mined & Material Mapping/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId('excavator-mapping-header-separator')).toBeInTheDocument();
    expect(screen.getByText('EX-10')).toBeInTheDocument();
    expect(screen.getByTestId('excavator-machine-id-separator-EX-10')).toBeInTheDocument();
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

  it('renders Plant and Other buttons and logs Excavator as a regular machine when selected', async () => {
    render(<ExcavatorActivityForm {...mockProps} />);

    const plantBtn = screen.getByRole('button', { name: 'Plant' });
    const otherBtn = screen.getByRole('button', { name: 'Other' });
    expect(plantBtn).toBeInTheDocument();
    expect(otherBtn).toBeInTheDocument();

    fireEvent.click(plantBtn);
    expect(plantBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Regular Machine Mode (Plant)')).toBeInTheDocument();

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          excavatorId: 'ex-10',
          materialType: 'Plant',
        })
      );
    });

    fireEvent.click(otherBtn);
    expect(otherBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Regular Machine Mode (Other)')).toBeInTheDocument();

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          excavatorId: 'ex-10',
          materialType: 'Other',
        })
      );
    });
  });

  it('supports Quick Add Block (+) with auto-formatting for block name and BLK-* code', async () => {
    render(<ExcavatorActivityForm {...mockProps} />);

    const quickAddBtn = screen.getByTestId('quick-add-block-btn-EX-10');
    fireEvent.click(quickAddBtn);

    expect(screen.getByTestId('quick-add-block-panel-EX-10')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('New block name for EX-10');
    fireEvent.change(nameInput, { target: { value: 'brakfontein pit bench d' } });

    const saveBtn = screen.getByLabelText('Save quick block for EX-10');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(quickAddMineBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-1',
          excavatorId: 'ex-10',
          siteId: 'site-1',
          name: 'Brakfontein Pit Bench D',
          code: 'BLK-MAIN-BRAK-D',
        })
      );
    });
  });

  it('switches Waste / Coal immediately on click even when todayActivities has an existing entry', async () => {
    render(
      <ExcavatorActivityForm
        {...mockProps}
        todayActivities={[
          {
            id: 'act-1',
            machine_id: 'ex-10',
            shift_type: 'day',
            site_id: 'site-1',
            block_mined_id: 'blk-1',
            material_type: 'Waste — Overburden',
            activity_date: '2026-10-23',
          },
        ]}
      />
    );

    const wasteBtn = screen.getByRole('button', { name: 'Waste' });
    const coalBtn = screen.getByRole('button', { name: 'Coal' });
    expect(wasteBtn).toHaveAttribute('aria-pressed', 'true');
    expect(coalBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(coalBtn);

    // Must switch synchronously before async server action finishes
    expect(coalBtn).toHaveAttribute('aria-pressed', 'true');
    expect(wasteBtn).toHaveAttribute('aria-pressed', 'false');

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          excavatorId: 'ex-10',
          materialType: 'Coal',
        })
      );
    });
  });

  it('renders ExcavatorActivityTelemetryOverview with full-width header, golden separator, global tally, golden borders, % badges, and graphs', () => {
    render(
      <ExcavatorActivityTelemetryOverview
        totalBcm={1350}
        totalLoads={45}
        activeExcavators={3}
        fleetExcavatorsCount={6}
        wasteLoads={30}
        coalLoads={15}
        plantUnitsCount={1}
        otherUnitsCount={1}
        targetBcm={5400}
        targetLoads={180}
      />
    );

    expect(screen.getByTestId('excavator-activity-header-row')).toBeInTheDocument();
    expect(screen.getByTestId('excavator-global-combined-tally')).toBeInTheDocument();
    expect(screen.getByTestId('excavator-header-golden-separator')).toBeInTheDocument();

    expect(screen.getByText('Total BCM')).toHaveClass('gold-steel-border');
    expect(screen.getByText('Total Loads')).toHaveClass('gold-steel-border');
    expect(screen.getByText('Active Excavators')).toHaveClass('gold-steel-border');

    expect(screen.getByTestId('total-bcm-pct-badge')).toHaveTextContent('25.0%');
    expect(screen.getByTestId('total-loads-pct-badge')).toHaveTextContent('25.0%');
    expect(screen.getByTestId('active-excavators-pct-badge')).toHaveTextContent('50.0% (3/6)');

    expect(screen.getByTestId('excavator-golden-graph-total-bcm')).toBeInTheDocument();
    expect(screen.getByTestId('excavator-golden-graph-total-loads')).toBeInTheDocument();
    expect(screen.getByTestId('excavator-golden-graph-active-excavators')).toBeInTheDocument();
  });
});
