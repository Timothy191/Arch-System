import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { toast } from 'sonner';
import { MAX_PDF_CONSUMPTION_ROWS, PlantInventoryPdfDocument } from './PlantInventoryPdfDocument';
import { PlantInventoryPdfReportView } from './PlantInventoryPdfReportView';
import { buildPlantInventoryAnalytics } from './plant-inventory-analytics';
import { downloadPlantInventoryCsv } from './plant-inventory-export';
import {
  INITIAL_PLANT_STOCK_ITEMS,
  INITIAL_PLANT_USAGE_HISTORY,
  type PlantInventoryUsageEntry,
} from './plant-inventory-seeds';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="plant-pdf-doc">{children}</div>
  ),
  Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({
    children,
    render: renderFn,
  }: {
    children?: React.ReactNode;
    render?: (pageInfo: { pageNumber: number; totalPages: number }) => string;
  }) => <span>{renderFn ? renderFn({ pageNumber: 1, totalPages: 3 }) : children}</span>,
  StyleSheet: { create: (styleMap: unknown) => styleMap },
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  })),
}));

const { pdf: mockedPdf } = jest.requireMock<{ pdf: jest.Mock }>('@react-pdf/renderer');

const TODAY = '2026-10-22';
const PREVIEW_LABEL = 'Plant Inventory PDF Report Preview';

function renderView() {
  return render(
    <PlantInventoryPdfReportView
      today={TODAY}
      stockItems={INITIAL_PLANT_STOCK_ITEMS}
      usageHistory={INITIAL_PLANT_USAGE_HISTORY}
    />
  );
}

function getPreview(): HTMLElement {
  return screen.getByRole('article', { name: PREVIEW_LABEL });
}

describe('PlantInventoryPdfReportView', () => {
  let printSpy: jest.SpyInstance;
  let clickSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:plant-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
    printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    printSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('renders the studio toolbar and the full live A4 preview', () => {
    renderView();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Plant Inventory PDF Report' })
    ).toBeInTheDocument();
    expect(screen.getByText('PLANT INVENTORY · PDF STUDIO')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/plant-inventory/reports'
    );
    const pdfLink = screen.getByRole('link', { name: 'PDF Report' });
    expect(pdfLink).toHaveAttribute('href', '/plant-inventory/reports?tab=pdf-report');
    expect(pdfLink).toHaveAttribute('aria-current', 'page');

    const preview = within(getPreview());
    expect(preview.getByText('Plant Inventory Executive Report')).toBeInTheDocument();
    expect(preview.getByText(`PI-RPT-${TODAY}`)).toBeInTheDocument();
    expect(preview.getByText('Stock Health by Category')).toBeInTheDocument();
    expect(
      preview.getByRole('table', { name: 'Prioritized Replenishment Demand' })
    ).toBeInTheDocument();
    expect(
      preview.getByRole('table', { name: 'Complete Stock Balance Register' })
    ).toBeInTheDocument();
    expect(preview.getByRole('table', { name: 'Equipment Drawdown' })).toBeInTheDocument();
    expect(preview.getByText('Recent Shift Consumption')).toBeInTheDocument();
    expect(preview.getByText('Plant Superintendent')).toBeInTheDocument();
    expect(
      preview.getByText('Plantcor / Arch OS · Confidential Operational Report')
    ).toBeInTheDocument();
  });

  it('narrows the preview when category and equipment filters change', () => {
    renderView();

    fireEvent.change(screen.getByRole('combobox', { name: 'Report category' }), {
      target: { value: 'Reagents' },
    });
    const register = () =>
      within(getPreview()).getByRole('table', { name: 'Complete Stock Balance Register' });
    expect(within(register()).getByText('MIBC Frother Reagent (IBC Bulk)')).toBeInTheDocument();
    expect(
      within(register()).queryByText('Magnetite Superfine Medium (96% Fe3O4)')
    ).not.toBeInTheDocument();
    expect(within(getPreview()).getByText(/Category: Reagents/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Report equipment' }), {
      target: { value: 'Tailings Thickener TH-501' },
    });
    expect(within(register()).getByText('Anionic Flocculant SNF AN-934SH')).toBeInTheDocument();
    expect(
      within(register()).queryByText('MIBC Frother Reagent (IBC Bulk)')
    ).not.toBeInTheDocument();
    expect(
      within(getPreview()).getByText(
        'All stock lines are at or above par — no replenishment demand.'
      )
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Report category' }), {
      target: { value: 'Stockpiles' },
    });
    expect(
      within(getPreview()).getByText('No categories match the selected filters.')
    ).toBeInTheDocument();
    expect(
      within(getPreview()).getByText('No consumption logged for the selected scope.')
    ).toBeInTheDocument();
  });

  it('toggles scope and zoom segmented controls', () => {
    renderView();

    const replenishOnly = screen.getByRole('button', { name: 'Replenishment Only' });
    fireEvent.click(replenishOnly);
    expect(replenishOnly).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All Stock Lines' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    const register = within(getPreview()).getByRole('table', {
      name: 'Complete Stock Balance Register',
    });
    expect(within(register).queryByText('Anionic Flocculant SNF AN-934SH')).not.toBeInTheDocument();
    expect(within(getPreview()).getByText('Replenishment Only (Below Par)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '75%' }));
    expect(screen.getByRole('button', { name: '75%' })).toHaveAttribute('aria-pressed', 'true');
    expect(getPreview().style.transform).toBe('scale(0.75)');

    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(getPreview().style.transform).toBe('scale(1)');

    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(getPreview().style.transform).toBe('');
    expect(getPreview().style.maxWidth).toBe('100%');
  });

  it('opens the browser print dialog from Print A4', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Print A4' }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('downloads the vector PDF with the active scope and filters', async () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Replenishment Only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF Report' }));

    expect(screen.getByRole('button', { name: 'Preparing PDF…' })).toBeDisabled();

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Plant Inventory PDF report downloaded.')
    );
    expect(mockedPdf).toHaveBeenCalledTimes(1);
    const docElement = mockedPdf.mock.calls[0]?.[0] as {
      props: { scopeLabel: string; filterLabel: string; today: string };
    };
    expect(docElement.props.scopeLabel).toBe('Replenishment Only (Below Par)');
    expect(docElement.props.filterLabel).toBe(
      'Category: All Categories · Equipment: All Equipment'
    );
    expect(docElement.props.today).toBe(TODAY);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Download PDF Report' })).not.toBeDisabled();
  });

  it('falls back to print preview when PDF generation fails', async () => {
    mockedPdf.mockReturnValueOnce({
      toBlob: jest.fn().mockRejectedValue(new Error('font load failed')),
    });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF Report' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('font load failed'));
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('reports an unknown error reason for non-Error PDF failures', async () => {
    mockedPdf.mockReturnValueOnce({ toBlob: jest.fn().mockRejectedValue('renderer crashed') });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF Report' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('unknown error'))
    );
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});

describe('PlantInventoryPdfDocument', () => {
  const analytics = buildPlantInventoryAnalytics({
    stockItems: INITIAL_PLANT_STOCK_ITEMS,
    usageHistory: INITIAL_PLANT_USAGE_HISTORY,
  });

  it('renders every executive section with full data', () => {
    render(
      <PlantInventoryPdfDocument
        today={TODAY}
        scopeLabel="All Stock Lines"
        filterLabel="Category: All Categories · Equipment: All Equipment"
        analytics={analytics}
        usageHistory={INITIAL_PLANT_USAGE_HISTORY}
      />
    );

    expect(screen.getByTestId('plant-pdf-doc')).toBeInTheDocument();
    expect(screen.getByText('ARCH OS · PLANT INVENTORY & STOCK CONTROL')).toBeInTheDocument();
    expect(screen.getByText('Plant Inventory Executive Report')).toBeInTheDocument();
    expect(screen.getByText(`Document ID: PI-RPT-${TODAY}`)).toBeInTheDocument();
    expect(screen.getByText('Stock Health by Category')).toBeInTheDocument();
    expect(screen.getByText('Prioritized Replenishment Demand')).toBeInTheDocument();
    expect(screen.getByText('Complete Stock Balance Register')).toBeInTheDocument();
    expect(screen.getByText('Equipment Drawdown')).toBeInTheDocument();
    expect(screen.getByText('Recent Shift Consumption')).toBeInTheDocument();
    expect(screen.getByText('Stock Controller')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(
      screen.getByText('Plantcor / Arch OS · Confidential Operational Report')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Replenish').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Healthy').length + screen.getAllByText('Watch').length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText('All stock lines are at or above par — no replenishment demand.')
    ).not.toBeInTheDocument();
  });

  it('renders empty states when there is no replenishment demand or consumption', () => {
    const atParItems = INITIAL_PLANT_STOCK_ITEMS.filter(
      (stockItem) => stockItem.amountPresent >= stockItem.amountRequired
    );
    render(
      <PlantInventoryPdfDocument
        today={TODAY}
        scopeLabel="All Stock Lines"
        filterLabel="Category: All Categories · Equipment: All Equipment"
        analytics={buildPlantInventoryAnalytics({ stockItems: atParItems, usageHistory: [] })}
        usageHistory={[]}
      />
    );

    expect(
      screen.getByText('All stock lines are at or above par — no replenishment demand.')
    ).toBeInTheDocument();
    expect(screen.getByText('No consumption logged for the selected scope.')).toBeInTheDocument();
  });

  it(`caps the consumption log at ${MAX_PDF_CONSUMPTION_ROWS} rows`, () => {
    const template = INITIAL_PLANT_USAGE_HISTORY[0] as PlantInventoryUsageEntry;
    const manyEntries: PlantInventoryUsageEntry[] = Array.from(
      { length: MAX_PDF_CONSUMPTION_ROWS + 3 },
      (_unused, index) => ({ ...template, id: `bulk-${index}`, loggedBy: `Operator ${index}` })
    );
    render(
      <PlantInventoryPdfDocument
        today={TODAY}
        scopeLabel="All Stock Lines"
        filterLabel="Category: All Categories · Equipment: All Equipment"
        analytics={analytics}
        usageHistory={manyEntries}
      />
    );

    expect(screen.getByText(`Operator ${MAX_PDF_CONSUMPTION_ROWS - 1}`)).toBeInTheDocument();
    expect(screen.queryByText(`Operator ${MAX_PDF_CONSUMPTION_ROWS}`)).not.toBeInTheDocument();
  });
});

describe('downloadPlantInventoryCsv', () => {
  it('triggers a CSV blob download and confirms with a toast', () => {
    jest.useFakeTimers();
    const createObjectURL = jest.fn(() => 'blob:plant-csv');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { enrichedItems } = buildPlantInventoryAnalytics({
      stockItems: INITIAL_PLANT_STOCK_ITEMS,
      usageHistory: [],
    });

    downloadPlantInventoryCsv({ items: enrichedItems, today: TODAY });

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      `Exported ${enrichedItems.length} stock lines to CSV.`
    );
    jest.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:plant-csv');

    clickSpy.mockRestore();
    jest.useRealTimers();
  });
});
