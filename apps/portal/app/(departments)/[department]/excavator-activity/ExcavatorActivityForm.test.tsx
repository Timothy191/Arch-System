import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { quickAddMineBlock, updateExcavatorAssignmentConfig } from '../hourly-loads/actions';
import { saveExcavatorShiftTelemetry } from './actions';
import { ExcavatorActivityForm } from './ExcavatorActivityForm';
import { ExcavatorActivityTelemetryOverview } from './ExcavatorActivityTelemetryOverview';

jest.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: ReactNode }) => <>{children}</>,
  MotionConfig: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  m: {
    div: ({
      children,
      variants: _variants,
      initial: _initial,
      animate: _animate,
      custom: _custom,
      ...rest
    }: Record<string, unknown> & { children?: ReactNode }) => <div {...rest}>{children}</div>,
    span: ({
      children,
      layoutId,
      transition: _transition,
      ...rest
    }: Record<string, unknown> & { children?: ReactNode; layoutId?: string }) => (
      <span data-layout-id={layoutId} {...rest}>
        {children}
      </span>
    ),
  },
}));

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

jest.mock('./actions', () => ({
  saveExcavatorShiftTelemetry: jest.fn().mockResolvedValue({
    success: true,
    startSmr: 14500,
    stopSmr: 14510,
    hoursWorked: 10,
    operatorId: 'op-1',
    operatorName: 'Thabo Mokoena',
    comment: 'Clean cut on Bench B',
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

  it('renders Excavator Location, Block Mined & Material Mapping panel, golden separators, and accessible loads table', () => {
    render(<ExcavatorActivityForm {...mockProps} />);

    expect(
      screen.getByRole('heading', {
        name: /Excavator Location, Block Mined & Material Mapping/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId('excavator-mapping-header-separator')).toBeInTheDocument();
    expect(screen.getByText('EX-10')).toBeInTheDocument();
    expect(screen.getByTestId('excavator-machine-id-separator-EX-10')).toBeInTheDocument();

    const tableContainer = screen.getByTestId('excavator-loads-table-EX-10');
    expect(within(tableContainer).getByText('Machine ID')).toBeInTheDocument();
    expect(within(tableContainer).getByText('Loads')).toBeInTheDocument();
    expect(within(tableContainer).getByText('Total Material')).toBeInTheDocument();
    expect(within(tableContainer).getByText('DT-01')).toBeInTheDocument();
    const totalRow = screen.getByTestId('excavator-loads-total-EX-10');
    expect(totalRow).toHaveTextContent('Total');
    expect(totalRow).toHaveTextContent('6');
    expect(totalRow).toHaveTextContent('150 BCM');
  });

  it('renders empty state row in the loads table when no machines are assigned', () => {
    render(<ExcavatorActivityForm {...mockProps} todayDumperLoads={[]} />);

    const tableContainer = screen.getByTestId('excavator-loads-table-EX-10');
    expect(within(tableContainer).getByText('No machines assigned this shift')).toBeInTheDocument();
    const totalRow = screen.getByTestId('excavator-loads-total-EX-10');
    expect(totalRow).toHaveTextContent('0');
    expect(totalRow).toHaveTextContent('0 BCM');
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

    expect(screen.getByTestId('material-pill-EX-10')).toHaveAttribute(
      'data-layout-id',
      'material-pill-ex-10'
    );

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-1',
          excavatorId: 'ex-10',
          materialType: 'Coal',
          materialSubCategory: null,
        })
      );
    });
  });

  it('moves Plant and Other excavators to the end of the log without duplicate panels and supports activity selection', async () => {
    render(
      <ExcavatorActivityForm
        {...mockProps}
        excavators={[
          {
            id: 'ex-10',
            name: 'EX-10',
            machine_type: 'Excavator',
            serial_number: 'Hitachi 400',
            site_id: 'site-1',
          },
          {
            id: 'ex-20',
            name: 'EX-20',
            machine_type: 'Excavator',
            serial_number: 'CAT 349',
            site_id: 'site-2',
          },
          {
            id: 'ex-30',
            name: 'EX-30',
            machine_type: 'Excavator',
            serial_number: 'Komatsu PC450',
            site_id: 'site-1',
          },
        ]}
        todayActivities={[
          {
            id: 'act-plant',
            machine_id: 'ex-10',
            shift_type: 'day',
            site_id: 'site-1',
            material_type: 'Plant - ROM Feed',
            activity_date: '2026-10-23',
          },
          {
            id: 'act-waste',
            machine_id: 'ex-20',
            shift_type: 'day',
            site_id: 'site-2',
            material_type: 'Waste',
            activity_date: '2026-10-23',
          },
          {
            id: 'act-other',
            machine_id: 'ex-30',
            shift_type: 'day',
            site_id: 'site-1',
            material_type: 'Other - Trenching',
            activity_date: '2026-10-23',
          },
        ]}
      />
    );

    // No duplicate Plant/Other panels
    expect(screen.queryByTestId('plant-excavators-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('other-excavators-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('regular-machines-divider')).toBeInTheDocument();

    // EX-20 (Waste) comes first, then EX-10 (Plant) and EX-30 (Other) at the end
    const cards = screen.getAllByTestId(/^excavator-activity-card-/);
    expect(cards.map((el) => el.getAttribute('data-testid'))).toEqual([
      'excavator-activity-card-EX-20',
      'excavator-activity-card-EX-10',
      'excavator-activity-card-EX-30',
    ]);

    expect(screen.getByText('Regular Machine Mode (Plant)')).toBeInTheDocument();
    expect(screen.getByText('Regular Machine Mode (Other)')).toBeInTheDocument();

    // Select Plant activity inside EX-10 card
    const plantActivitySelect = screen.getByLabelText('Select Plant activity for EX-10');
    fireEvent.change(plantActivitySelect, { target: { value: 'Crusher Feed' } });

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          excavatorId: 'ex-10',
          materialType: 'Plant',
          materialSubCategory: 'Crusher Feed',
        })
      );
    });

    // Switching EX-20 to Plant moves it into the end group
    const ex20Card = screen.getByTestId('excavator-activity-card-EX-20');
    fireEvent.click(within(ex20Card).getByRole('button', { name: 'Plant' }));

    await waitFor(() => {
      expect(updateExcavatorAssignmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          excavatorId: 'ex-20',
          materialType: 'Plant',
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

  it('renders ExcavatorActivityTelemetryOverview with full-width header, golden separator, global tally, golden borders, and % badges without synthetic graphs', () => {
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

    expect(screen.queryByTestId('excavator-golden-graph-total-bcm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('excavator-golden-graph-total-loads')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('excavator-golden-graph-active-excavators')
    ).not.toBeInTheDocument();
  });

  it('filters operator select to excavator operators, enforces Stop SMR delay-aware cap, and saves shift telemetry', async () => {
    render(
      <ExcavatorActivityForm
        {...mockProps}
        operators={[
          {
            id: 'op-1',
            full_name: 'Thabo Mokoena',
            employee_code: 'EMP-101',
            role: 'Excavator Operator',
          },
          {
            id: 'op-2',
            full_name: 'Sipho Dlamini',
            employee_code: 'EMP-102',
            role: 'ADT Driver',
          },
        ]}
        initialShiftTelemetry={{
          'ex-10|day': {
            startSmr: 14500,
            stopSmr: null,
            startSmrSource: 'previous_shift',
            operatorId: null,
            comment: '',
          },
        }}
        shiftDelayHours={{
          'ex-10|day': 2,
        }}
      />
    );

    expect(screen.getByTestId('excavator-activity-card-EX-10')).toHaveClass(
      'gold-steel-border',
      'shadow-card'
    );
    expect(screen.getByText('Start: Prev Shift')).toBeInTheDocument();

    const startInput = screen.getByLabelText('Start SMR for EX-10') as HTMLInputElement;
    const stopInput = screen.getByLabelText('Stop SMR for EX-10') as HTMLInputElement;
    const operatorSelect = screen.getByLabelText('Select Operator for EX-10') as HTMLSelectElement;
    const commentInput = screen.getByLabelText('Shift comment for EX-10') as HTMLTextAreaElement;
    const saveBtn = screen.getByLabelText('Save shift telemetry for EX-10');

    expect(startInput.value).toBe('14500');
    expect(stopInput).toHaveAttribute('max', '14510');
    expect(screen.getByTestId('smr-cap-hint-EX-10')).toHaveTextContent(
      'Max Stop SMR 14510 (12 h − 2 h delay)'
    );

    // Operator dropdown filters to excavator operators only
    const optionLabels = Array.from(operatorSelect.options).map((opt) => opt.textContent);
    expect(optionLabels).toContain('Thabo Mokoena (EMP-101)');
    expect(optionLabels).not.toContain('Sipho Dlamini (EMP-102)');

    // Entering Stop SMR below Start SMR shows inline alert and disables saving
    fireEvent.change(stopInput, { target: { value: '14490' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Stop SMR cannot be lower than Start SMR.');
    expect(saveBtn).toBeDisabled();

    // Entering Stop SMR above delay-aware cap shows inline alert and disables saving
    fireEvent.change(stopInput, { target: { value: '14511' } });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Stop SMR cannot exceed 14510 (Start SMR + 12 h − 2 h delay).'
    );
    expect(saveBtn).toBeDisabled();

    // Enter valid Stop SMR within cap, Operator, and Comment
    fireEvent.change(stopInput, { target: { value: '14510' } });
    expect(screen.getByTestId('shift-hours-badge-EX-10')).toHaveTextContent('10.0 hrs');
    expect(saveBtn).toBeEnabled();

    fireEvent.change(operatorSelect, { target: { value: 'op-1' } });
    fireEvent.change(commentInput, { target: { value: 'Clean cut on Bench B' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveExcavatorShiftTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-1',
          excavatorId: 'ex-10',
          loadDate: '2026-10-23',
          shiftType: 'day',
          startSmr: 14500,
          stopSmr: 14510,
          operatorId: 'op-1',
          operatorName: 'Thabo Mokoena',
          comment: 'Clean cut on Bench B',
        })
      );
    });
  });
});
