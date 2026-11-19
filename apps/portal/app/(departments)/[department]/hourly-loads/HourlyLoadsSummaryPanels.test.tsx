import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import {
  HourCell,
  HourlyLoadsSplitSection,
  HourlyLoadsTelemetryHeader,
  hourPropName,
} from './HourlyLoadsSummaryPanels';

jest.mock('@repo/ui', () => ({
  AnimatedDialog: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

jest.mock('@repo/ui/Logo', () => ({
  Logo: ({ className }: { className?: string }) => (
    <span data-testid="arch-logo" className={className} />
  ),
}));

jest.mock('@repo/ui/SecondaryButton', () => ({
  SecondaryButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

describe('HourlyLoadsSummaryPanels', () => {
  it('maps 0-based hour index to DB column names', () => {
    expect(hourPropName(0)).toBe('hour_01');
    expect(hourPropName(11)).toBe('hour_12');
  });

  it('renders locked and editable HourCell variants and handles stepper, keyboard, and blur edits', () => {
    const onStep = jest.fn();
    const onDirectEdit = jest.fn();

    const { rerender } = render(
      <table>
        <tbody>
          <tr>
            <HourCell
              value={5}
              rowIndex={0}
              hourProp="hour_01"
              hourLabel="06"
              editable={false}
              isLocked={true}
              onStep={onStep}
              onDirectEdit={onDirectEdit}
            />
          </tr>
        </tbody>
      </table>
    );

    expect(screen.getByText('5')).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <tr>
            <HourCell
              value={5}
              rowIndex={0}
              hourProp="hour_01"
              hourLabel="06"
              editable={true}
              isLocked={false}
              onStep={onStep}
              onDirectEdit={onDirectEdit}
            />
          </tr>
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decrease 06:00 loads' }));
    expect(onStep).toHaveBeenCalledWith(0, 'hour_01', -1);

    fireEvent.click(screen.getByRole('button', { name: 'Increase 06:00 loads' }));
    expect(onStep).toHaveBeenCalledWith(0, 'hour_01', 1);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onStep).toHaveBeenCalledTimes(4);

    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);
    expect(onDirectEdit).toHaveBeenCalledWith(0, 'hour_01', 12);
  });

  it('renders HourlyLoadsTelemetryHeader with en-US material formatting and series', () => {
    render(
      <HourlyLoadsTelemetryHeader
        selectedShift="day"
        grandTotalLoads={100}
        grandTotalMaterial={12500}
        activeMachinesCount={4}
        machinesCount={5}
        avgLoadsPerMachine={25}
        peakHour={{
          hourLabel: '07:00',
          shortLabel: '07',
          wasteLoads: 12,
          coalLoads: 8,
          totalLoads: 20,
          cumulativeLoads: 30,
        }}
        wasteTotalLoads={60}
        coalTotalLoads={40}
        hourlySeries={[
          {
            hourLabel: '06:00',
            shortLabel: '06',
            wasteLoads: 6,
            coalLoads: 4,
            totalLoads: 10,
            cumulativeLoads: 10,
          },
          {
            hourLabel: '07:00',
            shortLabel: '07',
            wasteLoads: 0,
            coalLoads: 0,
            totalLoads: 0,
            cumulativeLoads: 10,
          },
        ]}
        maxHourLoads={20}
      />
    );

    expect(screen.getByText('12,500 t total material')).toBeInTheDocument();
    expect(screen.getByText('80% fleet utilization')).toBeInTheDocument();
    expect(screen.getByText('W: 60 · C: 40')).toBeInTheDocument();
    expect(
      screen.getByText(/Live Hourly Production Timeline \(06:00 – 17:00\)/)
    ).toBeInTheDocument();
  });

  it('renders HourlyLoadsSplitSection and dispatches modal actions', () => {
    const onOpenSplitModal = jest.fn();
    const onCloseSplitModal = jest.fn();
    const onSplitMachineChange = jest.fn();
    const onSplitExcavatorChange = jest.fn();
    const onSplitMaterialChange = jest.fn();
    const onSplitStartHourChange = jest.fn();
    const onConfirmSplit = jest.fn();

    render(
      <HourlyLoadsSplitSection
        isSplitModalOpen={true}
        isSubmittingSplit={false}
        splitMachineId="m-1"
        splitExcavatorId="ex-1"
        splitMaterial="Waste"
        splitStartHour={4}
        machines={[{ id: 'm-1', name: 'ADT-01', machine_type: 'ADT' }]}
        excavators={[{ id: 'ex-1', name: 'EX-01', machine_type: 'Excavator' }]}
        sites={[{ id: 's-1', name: 'Pit North', site_code: 'PN' }]}
        excavatorSites={{ 'ex-1': 's-1' }}
        hourLabels={['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17']}
        onOpenSplitModal={onOpenSplitModal}
        onCloseSplitModal={onCloseSplitModal}
        onSplitMachineChange={onSplitMachineChange}
        onSplitExcavatorChange={onSplitExcavatorChange}
        onSplitMaterialChange={onSplitMaterialChange}
        onSplitStartHourChange={onSplitStartHourChange}
        onConfirmSplit={onConfirmSplit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add Machine Split/i }));
    expect(onOpenSplitModal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Coal' }));
    expect(onSplitMaterialChange).toHaveBeenCalledWith('Coal');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCloseSplitModal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Add Split/i }));
    expect(onConfirmSplit).toHaveBeenCalledTimes(1);
  });
});
