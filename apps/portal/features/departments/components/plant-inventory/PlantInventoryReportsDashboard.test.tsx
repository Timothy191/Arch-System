import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { PlantInventoryReportsDashboard } from './PlantInventoryReportsDashboard';
import { downloadPlantInventoryCsv, downloadPlantInventoryPdf } from './plant-inventory-export';
import {
  INITIAL_PLANT_STOCK_ITEMS,
  INITIAL_PLANT_USAGE_HISTORY,
  type PlantInventoryStockItem,
  type PlantInventoryUsageEntry,
} from './plant-inventory-seeds';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('./plant-inventory-export', () => ({
  downloadPlantInventoryPdf: jest.fn(async () => true),
  downloadPlantInventoryCsv: jest.fn(),
}));

const TODAY = '2026-10-22';
const TOTAL_SEED_LINES = INITIAL_PLANT_STOCK_ITEMS.length;
const MAGNETITE = 'Magnetite Superfine Medium (96% Fe3O4)';
const WARMAN = 'Warman 10/8 Slurry Pump Impellers';

const OUT_OF_STOCK_ITEM: PlantInventoryStockItem = {
  id: 'oos-liners',
  stock: 'Mill Shell Liners',
  code: 'ML-SH-01',
  category: 'Wear Spares',
  description: 'Rubber shell liners for regrind mill',
  amountRequired: 10,
  amountPresent: 0,
  unit: 'sets',
  plantEquipment: 'Regrind Mill RM-401',
};

const mockedPdf = jest.mocked(downloadPlantInventoryPdf);
const mockedCsv = jest.mocked(downloadPlantInventoryCsv);

function renderDashboard(
  overrides: {
    stockItems?: readonly PlantInventoryStockItem[];
    usageHistory?: readonly PlantInventoryUsageEntry[];
  } = {}
) {
  const onRestockItem = jest.fn();
  render(
    <PlantInventoryReportsDashboard
      today={TODAY}
      stockItems={overrides.stockItems ?? INITIAL_PLANT_STOCK_ITEMS}
      usageHistory={overrides.usageHistory ?? INITIAL_PLANT_USAGE_HISTORY}
      onRestockItem={onRestockItem}
    />
  );
  return { onRestockItem };
}

function getKpiRegion() {
  return screen.getByRole('region', { name: 'Key performance indicators' });
}

function getTable(name: string) {
  return screen.getByRole('table', { name });
}

describe('PlantInventoryReportsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given the seeded plant inventory', () => {
    it('When rendered, Then it shows the command header, required headings, and navigation', () => {
      renderDashboard();

      expect(screen.getByText('PLANT INVENTORY · EXECUTIVE ANALYTICS')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Reports' })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: 'Replenishment Demand Report' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: 'Consumption by Plant Equipment' })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Stock Health by Category' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Shift Consumption Split' })).toBeInTheDocument();
      expect(screen.getByText('Operational Date:')).toHaveTextContent(`Operational Date:${TODAY}`);

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toHaveAttribute('href', '/plant-inventory/reports');
      expect(dashboardLink).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'PDF Report' })).toHaveAttribute(
        'href',
        '/plant-inventory/reports?tab=pdf-report'
      );
      expect(
        screen.getByText(`Showing ${TOTAL_SEED_LINES} of ${TOTAL_SEED_LINES} stock lines`)
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reset Filters' })).not.toBeInTheDocument();
    });

    it('When rendered, Then the five KPI cards report compliance, coverage, alerts, equipment, and shifts', () => {
      renderDashboard();
      const kpis = within(getKpiRegion());

      expect(kpis.getByText('Par Compliance')).toBeInTheDocument();
      expect(kpis.getByText('50%')).toBeInTheDocument();
      expect(kpis.getByText('4/8 lines at par')).toBeInTheDocument();
      expect(kpis.getByText('Average Coverage')).toBeInTheDocument();
      expect(kpis.getByText('84.7%')).toBeInTheDocument();
      expect(kpis.getByText('Replenishment Alerts')).toBeInTheDocument();
      expect(kpis.getByText('0 critical')).toBeInTheDocument();
      expect(kpis.getByText('4 replenish')).toBeInTheDocument();
      expect(kpis.getByText('Tracked Equipment')).toBeInTheDocument();
      expect(kpis.getByText('7')).toBeInTheDocument();
      expect(kpis.getByText('3 at risk')).toBeInTheDocument();
      expect(kpis.getByText('Shift Drawdowns')).toBeInTheDocument();
      expect(kpis.getByText('Day 3')).toBeInTheDocument();
      expect(kpis.getByText('Night 2')).toBeInTheDocument();

      const parBar = kpis.getByRole('progressbar', { name: 'Par compliance percentage' });
      expect(parBar).toHaveAttribute('aria-valuenow', '50');
      expect(parBar).toHaveAttribute('aria-valuemin', '0');
      expect(parBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('When rendered, Then the intelligence row shows category health and the shift split', () => {
      renderDashboard();

      expect(
        screen.getByRole('progressbar', { name: 'Day versus night shift drawdown ratio' })
      ).toHaveAttribute('aria-valuenow', '60');
      expect(screen.getByText('Day 3 (60%)')).toBeInTheDocument();
      expect(screen.getByText('Night 2 (40.0%)')).toBeInTheDocument();
      expect(
        screen.getByRole('progressbar', { name: 'Dense Medium average coverage' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('progressbar', {
          name: 'Primary DMC Module CR-101 consumption share',
        })
      ).toHaveAttribute('aria-valuenow', '100');
    });

    it('When rendered, Then the replenishment table is prioritized and Mark Restocked fires the callback', () => {
      const { onRestockItem } = renderDashboard();
      const table = getTable('Replenishment Demand Report');
      const rows = within(table).getAllByRole('row').slice(1);

      expect(rows).toHaveLength(4);
      expect(rows[0]).toHaveTextContent('Dense Medium Cyclone Vortex Finders');
      expect(
        within(table).queryByText('Primary Jaw Crusher Toggle Plates')
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: `Mark Restocked ${MAGNETITE}` }));
      expect(onRestockItem).toHaveBeenCalledWith('mag-superfine-fe3o4');
    });

    it('When rendered, Then the consumption table lists equipment with below-par health pills', () => {
      renderDashboard();
      const table = getTable('Consumption by Plant Equipment');
      const columnHeaders = within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent);

      expect(columnHeaders).toEqual([
        'Plant Equipment',
        'Stock Lines',
        'Drawdown Entries',
        'Health',
        'Activity',
      ]);
      expect(within(table).getByText('2 below par')).toBeInTheDocument();
      expect(
        within(table).getByRole('progressbar', { name: 'Primary DMC Module CR-101 activity' })
      ).toBeInTheDocument();
    });

    it('When rendered, Then the audit log lists usage newest first with a full history link', () => {
      renderDashboard();
      const table = getTable('Recent Shift Consumption Audit Log');
      const rows = within(table).getAllByRole('row').slice(1);

      expect(rows).toHaveLength(INITIAL_PLANT_USAGE_HISTORY.length);
      expect(rows[0]).toHaveTextContent('2026-10-22');
      expect(rows[rows.length - 1]).toHaveTextContent('2026-10-19');
      expect(within(table).getByText('S. Mokoena (Metallurgist)')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Open Full History' })).toHaveAttribute(
        'href',
        '/plant-inventory/tools'
      );
    });
  });

  describe('Given the filter bar', () => {
    it('When searching, Then only matching stock lines remain and Reset Filters restores all', () => {
      renderDashboard();

      fireEvent.change(screen.getByRole('searchbox', { name: 'Search reports' }), {
        target: { value: 'Magnetite' },
      });

      expect(screen.getByText(`Showing 1 of ${TOTAL_SEED_LINES} stock lines`)).toBeInTheDocument();
      const table = getTable('Replenishment Demand Report');
      expect(within(table).getByText(MAGNETITE)).toBeInTheDocument();
      expect(within(table).queryByText(WARMAN)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Reset Filters' }));
      expect(
        screen.getByText(`Showing ${TOTAL_SEED_LINES} of ${TOTAL_SEED_LINES} stock lines`)
      ).toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: 'Search reports' })).toHaveValue('');
    });

    it('When selecting a category pill, Then the pill is pressed and lines are narrowed', () => {
      renderDashboard();
      const reagentsPill = screen.getByRole('button', { name: 'Reagents' });

      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(reagentsPill);

      expect(reagentsPill).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText(`Showing 2 of ${TOTAL_SEED_LINES} stock lines`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
    });

    it('When filtering by equipment, Then KPIs, tables, and the audit log follow the equipment scope', () => {
      renderDashboard();

      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by equipment' }), {
        target: { value: 'Tailings Thickener TH-501' },
      });

      expect(screen.getByText(`Showing 1 of ${TOTAL_SEED_LINES} stock lines`)).toBeInTheDocument();
      expect(screen.getByText('All filtered stock lines meet par quantities.')).toBeInTheDocument();
      const auditTable = getTable('Recent Shift Consumption Audit Log');
      expect(within(auditTable).getAllByRole('row')).toHaveLength(2);
      expect(within(auditTable).getByText('L. Ndlovu (Process Operator)')).toBeInTheDocument();
      expect(within(getKpiRegion()).getByText('Day 1')).toBeInTheDocument();
    });

    it('When filtering by status, Then critical and nominal views narrow the stock lines', () => {
      renderDashboard({ stockItems: [...INITIAL_PLANT_STOCK_ITEMS, OUT_OF_STOCK_ITEM] });
      const statusSelect = screen.getByRole('combobox', { name: 'Filter by status' });

      expect(within(getKpiRegion()).getByText('1 critical')).toBeInTheDocument();

      fireEvent.change(statusSelect, { target: { value: 'CRITICAL_OR_OOS' } });
      expect(screen.getByText('Showing 1 of 9 stock lines')).toBeInTheDocument();
      expect(screen.getByText('Out of Stock')).toBeInTheDocument();

      fireEvent.change(statusSelect, { target: { value: 'NOMINAL' } });
      expect(screen.getByText('Showing 4 of 9 stock lines')).toBeInTheDocument();
      expect(screen.getByText('All filtered stock lines meet par quantities.')).toBeInTheDocument();
    });
  });

  describe('Given the export actions', () => {
    it('When Export CSV is clicked, Then the filtered enriched items are exported', () => {
      renderDashboard();

      fireEvent.click(screen.getByRole('button', { name: 'Reagents' }));
      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(mockedCsv).toHaveBeenCalledTimes(1);
      const csvOptions = mockedCsv.mock.calls[0]?.[0];
      expect(csvOptions?.today).toBe(TODAY);
      expect(csvOptions?.items).toHaveLength(2);
      expect(csvOptions?.items[0]?.flags).toBeDefined();
    });

    it('When Download PDF is clicked, Then it disables while preparing and passes unfiltered labels', async () => {
      let resolvePdf: (isDirect: boolean) => void = () => undefined;
      mockedPdf.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePdf = resolve;
          })
      );
      renderDashboard();

      fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

      const pendingButton = screen.getByRole('button', { name: 'Preparing…' });
      expect(pendingButton).toBeDisabled();
      expect(mockedPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          today: TODAY,
          scopeLabel: 'All Plant Equipment',
          filterLabel: 'All stock lines',
          usageHistory: INITIAL_PLANT_USAGE_HISTORY,
        })
      );

      await act(async () => {
        resolvePdf(true);
      });
      expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
    });

    it('When Download PDF is clicked with filters, Then the scope and filter labels describe them', async () => {
      renderDashboard();

      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by equipment' }), {
        target: { value: 'Primary DMC Module CR-101' },
      });
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
        target: { value: 'BELOW_PAR' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Dense Medium' }));
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search reports' }), {
        target: { value: 'mag' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
      );
      const pdfOptions = mockedPdf.mock.calls[0]?.[0];
      expect(pdfOptions?.scopeLabel).toBe('Primary DMC Module CR-101');
      expect(pdfOptions?.filterLabel).toBe(
        'Category: Dense Medium · Equipment: Primary DMC Module CR-101 · Status: Below Par · Search: "mag"'
      );
      expect(pdfOptions?.analytics.totalLines).toBe(1);
    });

    it('When PDF generation rejects, Then an error toast is shown and the button recovers', async () => {
      mockedPdf.mockRejectedValueOnce(new Error('renderer offline'));
      renderDashboard();

      fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Plant Inventory PDF export failed (renderer offline).'
        )
      );
      expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
    });

    it('When PDF generation rejects with a non-Error, Then a generic reason is reported', async () => {
      mockedPdf.mockRejectedValueOnce('boom');
      renderDashboard();

      fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Plant Inventory PDF export failed (unknown error).'
        )
      );
    });
  });

  describe('Given sparse or large datasets', () => {
    it('When there is no stock or usage, Then every section renders its empty state', () => {
      renderDashboard({ stockItems: [], usageHistory: [] });

      expect(screen.getByText('Showing 0 of 0 stock lines')).toBeInTheDocument();
      expect(screen.getByText('No stock lines match the current filters.')).toBeInTheDocument();
      expect(screen.getByText('No drawdowns recorded for this scope.')).toBeInTheDocument();
      expect(screen.getByText('All filtered stock lines meet par quantities.')).toBeInTheDocument();
      expect(
        screen.getByText('No plant equipment activity matches the current filters.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('No consumption entries recorded for the selected equipment.')
      ).toBeInTheDocument();
      expect(screen.getByText('Night 0 (0.0%)')).toBeInTheDocument();
    });

    it('When there are more than eight usage entries, Then the audit log is capped at eight rows', () => {
      const manyEntries: PlantInventoryUsageEntry[] = Array.from({ length: 10 }, (_, index) => ({
        ...INITIAL_PLANT_USAGE_HISTORY[0]!,
        id: `bulk-${index}`,
        date: `2026-10-${String(index + 10).padStart(2, '0')}`,
      }));
      renderDashboard({ usageHistory: manyEntries });

      const rows = within(getTable('Recent Shift Consumption Audit Log'))
        .getAllByRole('row')
        .slice(1);
      expect(rows).toHaveLength(8);
      expect(rows[0]).toHaveTextContent('2026-10-19');
    });
  });
});
