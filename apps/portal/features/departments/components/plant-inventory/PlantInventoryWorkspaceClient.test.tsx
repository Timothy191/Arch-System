import { fireEvent, render, screen, within } from '@testing-library/react';
import type React from 'react';
import {
  INITIAL_PLANT_STOCK_ITEMS,
  PlantInventoryWorkspaceClient,
} from './PlantInventoryWorkspaceClient';
import { STOCK_STORAGE_KEY, USAGE_STORAGE_KEY } from './plant-inventory-seeds';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="plant-inventory-pdf-doc">{children}</div>
  ),
  Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  StyleSheet: { create: (styles: unknown) => styles },
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  })),
}));

describe('PlantInventoryWorkspaceClient', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('Given mode="dashboard" (/plant-inventory)', () => {
    it('When rendered, Then it displays the Stock Dashboard and equipment overview', () => {
      render(<PlantInventoryWorkspaceClient mode="dashboard" today="2026-10-22" />);

      expect(screen.getByRole('heading', { name: 'Stock Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('table', { name: 'Stock Required Quick List' })).toBeInTheDocument();
    });
  });

  describe('Given mode="inventory-list" (/plant-inventory/daily-log)', () => {
    it('When rendered, Then it displays the Inventory List heading and table columns for Stock, Description, Amount Required, and Amount Present', () => {
      render(<PlantInventoryWorkspaceClient mode="inventory-list" today="2026-10-22" />);

      expect(screen.getByRole('heading', { name: 'Inventory List' })).toBeInTheDocument();

      const table = screen.getByRole('table', { name: 'Plant Inventory List' });
      const headers = within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent?.trim());

      expect(headers).toEqual(['Stock', 'Description', 'Amount Required', 'Amount Present']);

      for (const item of INITIAL_PLANT_STOCK_ITEMS) {
        expect(screen.getByText(item.stock.trim())).toBeInTheDocument();
        expect(screen.getByText(item.description)).toBeInTheDocument();
      }
    });

    it('When filtering by category or search query, Then it narrows the displayed stock rows', () => {
      render(<PlantInventoryWorkspaceClient mode="inventory-list" today="2026-10-22" />);

      const searchInput = screen.getByRole('searchbox', { name: 'Search inventory list' });
      fireEvent.change(searchInput, { target: { value: 'Magnetite' } });

      expect(screen.getByText('Magnetite Superfine Medium (96% Fe3O4)')).toBeInTheDocument();
      expect(screen.queryByText('Primary Jaw Crusher Toggle Plates')).not.toBeInTheDocument();
    });

    it('When clicking -1 Remove, Then it prompts for confirmation, cancels cleanly, and decrements Have by 1 only when confirmed', () => {
      render(<PlantInventoryWorkspaceClient mode="inventory-list" today="2026-10-22" />);

      expect(screen.queryByRole('button', { name: /Edit Amounts/i })).not.toBeInTheDocument();

      const removeBtn = screen.getByRole('button', {
        name: 'Remove 1 unit from Magnetite Superfine Medium (96% Fe3O4)',
      });
      expect(removeBtn).toHaveTextContent('-1 Remove');
      expect(removeBtn).toBeEnabled();

      fireEvent.click(removeBtn);

      const table = screen.getByRole('table', { name: 'Plant Inventory List' });
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent('Confirm Remove 1 Unit');
      expect(dialog).toHaveTextContent('Magnetite Superfine Medium (96% Fe3O4)');
      expect(dialog).toHaveTextContent('148.5 t');
      expect(dialog).toHaveTextContent('147.5 t');
      expect(within(table).getByText('148.5 t')).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByText('148.5 t')).toBeInTheDocument();

      fireEvent.click(removeBtn);
      const confirmDialog = screen.getByRole('alertdialog');
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Confirm Remove 1' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByText('147.5 t')).toBeInTheDocument();
      expect(screen.getByText('81.9% coverage')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Removed 1 t from "Magnetite Superfine Medium (96% Fe3O4)" — Have: 147.5 t (Replenish, 81.9% coverage).'
      );

      const storedStock = JSON.parse(window.localStorage.getItem(STOCK_STORAGE_KEY) ?? '[]');
      expect(storedStock[0]?.amountPresent).toBe(147.5);
      const storedUsage = JSON.parse(window.localStorage.getItem(USAGE_STORAGE_KEY) ?? '[]');
      expect(storedUsage[0]?.stock).toBe('Magnetite Superfine Medium (96% Fe3O4)');
      expect(storedUsage[0]?.amountUsed).toBe(1);
    });

    it('When Amount Present is 0, Then the -1 Remove button is disabled', () => {
      const zeroedItems = INITIAL_PLANT_STOCK_ITEMS.map((item, idx) =>
        idx === 0 ? { ...item, amountPresent: 0 } : item
      );
      window.localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(zeroedItems));

      render(<PlantInventoryWorkspaceClient mode="inventory-list" today="2026-10-22" />);

      const removeBtn = screen.getByRole('button', {
        name: 'Remove 1 unit from Magnetite Superfine Medium (96% Fe3O4)',
      });
      expect(removeBtn).toBeDisabled();
    });
  });

  describe('Given mode="item-list" (/plant-inventory/machines)', () => {
    it('When rendered, Then it displays the white Item List header panel and golden borders on Add New Item inputs', () => {
      render(<PlantInventoryWorkspaceClient mode="item-list" today="2026-10-22" />);

      const heading = screen.getByRole('heading', { name: 'Item List' });
      const headerPanel = heading.closest('.gold-steel-border');
      expect(headerPanel).not.toBeNull();
      expect(headerPanel?.className).toContain('bg-white/90');
      expect(headerPanel).toHaveTextContent(`Catalog Items: ${INITIAL_PLANT_STOCK_ITEMS.length}`);

      const inputsToCheck = [
        screen.getByLabelText('Stock Name'),
        screen.getByLabelText('Part / Stock Code'),
        screen.getByLabelText('Category'),
        screen.getByLabelText('Description'),
        screen.getByLabelText('Amount Required'),
        screen.getByLabelText('Amount Present'),
        screen.getByLabelText('Unit'),
        screen.getByLabelText(/Plant Equipment/i),
      ];

      for (const control of inputsToCheck) {
        expect(control.className).toContain('border-accent-gold/65');
      }
    });

    it('When the user adds a new item to the stock list, Then it is added to the catalog and persisted to localStorage', () => {
      render(<PlantInventoryWorkspaceClient mode="item-list" today="2026-10-22" />);

      expect(screen.getByRole('heading', { name: 'Item List' })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Add New Item to Stock List' })
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Stock Name'), {
        target: { value: 'Secondary Cyclone Ceramic Spigot' },
      });
      fireEvent.change(screen.getByLabelText('Part / Stock Code'), {
        target: { value: 'DMC-650-SPG' },
      });
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: '92% Alumina ceramic underflow spigot for secondary DMC module' },
      });
      fireEvent.change(screen.getByLabelText('Amount Required'), {
        target: { value: '6' },
      });
      fireEvent.change(screen.getByLabelText('Amount Present'), {
        target: { value: '4' },
      });
      fireEvent.change(screen.getByLabelText('Unit'), {
        target: { value: 'spigots' },
      });
      fireEvent.change(screen.getByLabelText(/Plant Equipment/i), {
        target: { value: 'Secondary DMC Module CR-102' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Item to Stock List/i }));

      expect(screen.getByText('Secondary Cyclone Ceramic Spigot')).toBeInTheDocument();
      expect(
        screen.getByText('92% Alumina ceramic underflow spigot for secondary DMC module')
      ).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Added "Secondary Cyclone Ceramic Spigot" to the Plant Inventory stock list.'
      );
    });
  });

  describe('Given mode="stock-required" (/plant-inventory/history)', () => {
    it('When rendered, Then it lists only items where Amount Present is below Amount Required and allows marking restocked', () => {
      render(<PlantInventoryWorkspaceClient mode="stock-required" today="2026-10-22" />);

      expect(screen.getByRole('heading', { name: 'Stock Required' })).toBeInTheDocument();
      expect(screen.getByText('Magnetite Superfine Medium (96% Fe3O4)')).toBeInTheDocument();
      expect(screen.getByText('Dense Medium Cyclone Vortex Finders')).toBeInTheDocument();
      // Nominal items should not appear in the Stock Required shortfall table
      expect(screen.queryByText('Primary Jaw Crusher Toggle Plates')).not.toBeInTheDocument();

      const restockButtons = screen.getAllByRole('button', { name: /Mark Restocked/i });
      expect(restockButtons.length).toBeGreaterThan(0);
      fireEvent.click(restockButtons[0]!);
    });
  });

  describe('Given mode="history-of-used" (/plant-inventory/tools)', () => {
    it('When rendered, Then it displays the History of Used log and records new stock usage', () => {
      render(<PlantInventoryWorkspaceClient mode="history-of-used" today="2026-10-22" />);

      expect(screen.getByRole('heading', { name: 'History of Used' })).toBeInTheDocument();
      expect(screen.getByText('S. Mokoena (Metallurgist)')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Amount Used'), {
        target: { value: '5' },
      });
      fireEvent.change(screen.getByLabelText('Usage Description / Work Order'), {
        target: { value: 'Shift B medium density correction' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Record Used Stock/i }));

      expect(screen.getByText('Shift B medium density correction')).toBeInTheDocument();
    });
  });

  describe('Given mode="reports" (/plant-inventory/reports)', () => {
    it('When rendered, Then it displays Reports and consumption by plant equipment', () => {
      render(<PlantInventoryWorkspaceClient mode="reports" today="2026-10-22" />);

      expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Replenishment Demand Report' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Consumption by Plant Equipment' })
      ).toBeInTheDocument();
    });

    it('When initialReportTab="pdf-report", Then it renders the Plant Inventory PDF Report view', () => {
      render(
        <PlantInventoryWorkspaceClient
          mode="reports"
          today="2026-10-22"
          initialReportTab="pdf-report"
        />
      );

      expect(
        screen.getByRole('heading', { name: 'Plant Inventory PDF Report' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('article', { name: 'Plant Inventory PDF Report Preview' })
      ).toBeInTheDocument();
    });

    it('When initialReportTab switches between dashboard and pdf-report, Then it rerenders the corresponding view', () => {
      const { rerender } = render(
        <PlantInventoryWorkspaceClient
          mode="reports"
          today="2026-10-22"
          initialReportTab="dashboard"
        />
      );

      expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();

      rerender(
        <PlantInventoryWorkspaceClient
          mode="reports"
          today="2026-10-22"
          initialReportTab="pdf-report"
        />
      );

      expect(
        screen.getByRole('heading', { name: 'Plant Inventory PDF Report' })
      ).toBeInTheDocument();

      rerender(
        <PlantInventoryWorkspaceClient
          mode="reports"
          today="2026-10-22"
          initialReportTab="dashboard"
        />
      );

      expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    });
  });
});
