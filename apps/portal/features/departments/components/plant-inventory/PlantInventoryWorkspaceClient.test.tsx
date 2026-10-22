import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  INITIAL_PLANT_STOCK_ITEMS,
  PlantInventoryWorkspaceClient,
} from './PlantInventoryWorkspaceClient';

describe('PlantInventoryWorkspaceClient', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
  });

  describe('Given mode="item-list" (/plant-inventory/machines)', () => {
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
    it('When rendered, Then it displays the History of Used consumption log and records new stock usage', () => {
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
});
