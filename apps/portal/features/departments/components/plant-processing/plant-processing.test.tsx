import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlantDelaysClient } from './PlantDelaysClient';
import { PlantHistoryDatabaseClient } from './PlantHistoryDatabaseClient';
import { PlantHourlySheetClient } from './PlantHourlySheetClient';
import {
  buildDefaultHourlyRows,
  buildInitialPlantDelays,
  type PlantHourlySheetRecord,
} from './types';

jest.mock('./actions', () => ({
  savePlantHourlySheetAction: jest.fn(async () => ({
    success: true,
    message: 'Saved 12 hourly rows for 2026-10-21 (DAY shift).',
    savedAt: '2026-10-21T12:00:00.000Z',
  })),
  logPlantDelayAction: jest.fn(async (input) => ({
    success: true,
    entry: {
      id: 'delay-test-999',
      date: input.date,
      shift: input.shift,
      circuit: input.circuit,
      category: input.category,
      impactType: input.impactType,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: input.durationMinutes,
      reason: input.reason,
      correctiveAction: input.correctiveAction || 'Inspected circuit',
      loggedBy: 'Test Operator',
      status: 'Resolved',
    },
    message: 'Logged delay on primary crusher.',
  })),
}));

const sampleSheet: PlantHourlySheetRecord = {
  id: 'sheet-2026-10-21-day-DMS-MOD-1',
  date: '2026-10-21',
  shift: 'day',
  moduleId: 'DMS-MOD-1',
  operatorName: 'S. Mokoena',
  updatedAt: '2026-10-21T10:00:00.000Z',
  rows: buildDefaultHourlyRows('day'),
};

describe('Plant & Processing Workspace Components', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('PlantHourlySheetClient (Telemetry Cards, Pulse Graph, Pie Chart & Excel Grid)', () => {
    it('should render the 6 telemetry and chart cards (ROM Scale, Product Yield, Product Ash, Running Density, Live Production Pulse Graph, Production Mix Pie Chart) and update when cells change', async () => {
      render(<PlantHourlySheetClient initialDate="2026-10-21" initialSheets={[sampleSheet]} />);

      // Verify all 6 requested telemetry & visual cards render
      expect(screen.getByTestId('card-rom-scale')).toHaveTextContent(
        /ROM Scale \(t \/ Latest Hour\)/i
      );
      expect(screen.getByTestId('card-product-yield')).toHaveTextContent(
        /Product Yield \(% Recovery\)/i
      );
      expect(screen.getByTestId('card-product-ash')).toHaveTextContent(/Product Ash \(% ADB\)/i);
      expect(screen.getByTestId('card-running-density')).toHaveTextContent(/Running Density/i);
      expect(screen.getByTestId('card-live-production-pulse')).toHaveTextContent(
        /Live Production Pulse Graph — Current Throughput \(t\/h\)/i
      );
      expect(screen.getByTestId('card-live-production-pulse')).toHaveTextContent(/vs Prior Shift/i);
      expect(
        screen.getByRole('img', {
          name: /Live Production Pulse Graph showing hourly throughput in tonnes per hour/i,
        })
      ).toBeInTheDocument();
      expect(screen.queryByText(/Live DMS & Belt Scale SSoT/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('card-production-mix')).toHaveTextContent(
        /Production Mix — Product, Discard & Recovery/i
      );
      expect(screen.getByRole('img', { name: /Production Mix Pie Chart/i })).toBeInTheDocument();

      // Verify Excel-style Hourly Input Sheet renders and updates calculations
      expect(
        screen.getByRole('table', { name: /Plant and Processing Hourly Input Sheet/i })
      ).toBeInTheDocument();
      expect(screen.getByText('06:00 - 07:00')).toBeInTheDocument();
      expect(screen.getByText('17:00 - 18:00')).toBeInTheDocument();

      const row1RomInput = screen.getByLabelText('Row 1 ROM Feed') as HTMLInputElement;
      const row1CleanInput = screen.getByLabelText('Row 1 Clean Coal') as HTMLInputElement;
      const row1DiscardInput = screen.getByLabelText('Row 1 Discard') as HTMLInputElement;
      const row1AshInput = screen.getByLabelText('Row 1 Product Ash') as HTMLInputElement;

      fireEvent.change(row1RomInput, { target: { value: '500' } });
      fireEvent.change(row1CleanInput, { target: { value: '450' } });
      fireEvent.change(row1AshInput, { target: { value: '13.5' } });

      expect(row1DiscardInput.value).toBe('50');
      expect(row1AshInput.value).toBe('13.5');

      const saveBtn = screen.getByTestId('save-plant-hourly-sheet');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Saved 12 hourly rows/i);
      });
    });

    it('should switch to Night Shift (18:00-06:00) hourly slots when Night Shift is selected', () => {
      render(<PlantHourlySheetClient initialDate="2026-10-21" initialSheets={[sampleSheet]} />);

      fireEvent.click(screen.getByRole('button', { name: /Night Shift \(18:00–06:00\)/i }));
      expect(screen.getByText('18:00 - 19:00')).toBeInTheDocument();
      expect(screen.getByText('05:00 - 06:00')).toBeInTheDocument();
    });

    it('should separate Dashboard mode (/plant-processing) and Hourly Sheet mode (/plant-processing/hourly-sheet)', () => {
      const { unmount } = render(
        <PlantHourlySheetClient
          initialDate="2026-10-21"
          initialSheets={[sampleSheet]}
          mode="dashboard"
        />
      );
      expect(screen.getByTestId('card-rom-scale')).toBeInTheDocument();
      expect(screen.getByTestId('card-live-production-pulse')).toBeInTheDocument();
      expect(
        screen.queryByRole('table', { name: /Plant and Processing Hourly Input Sheet/i })
      ).not.toBeInTheDocument();
      unmount();

      render(
        <PlantHourlySheetClient
          initialDate="2026-10-21"
          initialSheets={[sampleSheet]}
          mode="sheet"
        />
      );
      expect(
        screen.getByRole('table', { name: /Plant and Processing Hourly Input Sheet/i })
      ).toBeInTheDocument();
      expect(screen.queryByTestId('card-rom-scale')).not.toBeInTheDocument();
    });
  });

  describe('PlantDelaysClient (Delays Tab)', () => {
    it('should render initial plant delays and log a new plant delay entry', async () => {
      const initialDelays = buildInitialPlantDelays('2026-10-21');
      render(<PlantDelaysClient initialDate="2026-10-21" initialDelays={initialDelays} />);

      expect(
        screen.getByRole('heading', { name: /Plant & Processing Delays/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Oversize slab bridged across primary jaw crusher/i)
      ).toBeInTheDocument();

      const causeTextarea = screen.getByPlaceholderText(
        /Oversize ROM rock bridged primary jaw crusher/i
      );
      fireEvent.change(causeTextarea, {
        target: { value: 'Magnetite medium pump seal flush interruption' },
      });

      fireEvent.click(screen.getByTestId('submit-plant-delay-btn'));

      await waitFor(() => {
        expect(
          screen.getByText('Magnetite medium pump seal flush interruption')
        ).toBeInTheDocument();
      });
    });
  });

  describe('PlantHistoryDatabaseClient (History Reports Database)', () => {
    it('should switch between Monthly Reports, Daily Reports, and Hourly Reports database tables', () => {
      const initialDelays = buildInitialPlantDelays('2026-10-21');
      render(
        <PlantHistoryDatabaseClient
          initialDate="2026-10-21"
          initialSheets={[sampleSheet]}
          initialDelays={initialDelays}
        />
      );

      // Default is Daily Reports
      expect(
        screen.getByRole('table', { name: /Daily Plant Reports Database/i })
      ).toBeInTheDocument();

      // Switch to Monthly Reports
      fireEvent.click(screen.getByRole('tab', { name: /Monthly Reports/i }));
      expect(
        screen.getByRole('table', { name: /Monthly Plant Reports Database/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/October 2026/i)).toBeInTheDocument();

      // Switch to Hourly Reports
      fireEvent.click(screen.getByRole('tab', { name: /Hourly Reports/i }));
      expect(
        screen.getByRole('table', { name: /Hourly Plant Reports Database/i })
      ).toBeInTheDocument();
      expect(screen.getByText('06:00 - 07:00')).toBeInTheDocument();
    });
  });
});
