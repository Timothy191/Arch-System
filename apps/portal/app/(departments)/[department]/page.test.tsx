import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DepartmentDashboard from './page';

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest
    .fn()
    .mockImplementation(async ({ department }: { department: string }) => ({
      dept: {
        name: department,
        displayName: department === 'plant-inventory' ? 'Plant Inventory' : 'Department',
        type: department === 'control-room' ? 'control_room' : 'standard',
      },
      deptId: 'dept-uuid-1',
      today: '2026-10-22',
    })),
}));

jest.mock('~/features/departments/components/plant-processing/actions', () => ({
  getPlantProcessingWorkspaceData: jest.fn().mockResolvedValue({
    currentDate: '2026-10-22',
    initialSheets: {},
  }),
}));

jest.mock('~/features/departments/components/plant-processing/PlantHourlySheetClient', () => ({
  PlantHourlySheetClient: () => <div data-testid="plant-hourly-sheet-client" />,
}));

jest.mock('~/features/departments/components/production/ProductionDashboard', () => ({
  ProductionDashboard: () => <div data-testid="production-dashboard" />,
  MonthlyProductionTargetBanner: () => <div data-testid="monthly-target-banner" />,
}));

jest.mock('./ControlRoomSummaryGridClient', () => ({
  ControlRoomSummaryGridClient: () => <div data-testid="control-room-summary" />,
}));

jest.mock('./NonControlRoomSummaryGridClient', () => ({
  NonControlRoomSummaryGridClient: () => <div data-testid="non-control-room-summary" />,
}));

describe('DepartmentDashboard ([department]/page.tsx)', () => {
  describe('when department is plant-inventory', () => {
    it('renders the Plant Inventory & Reagents Control KPI strip with ROM, Clean Coal, Magnetite, and Reagent metrics', async () => {
      const jsx = await DepartmentDashboard({
        params: Promise.resolve({ department: 'plant-inventory' }),
      });
      render(jsx);

      expect(screen.getByText('Plant Inventory & Reagents Control')).toBeInTheDocument();
      expect(screen.getByText('ROM Stockpile Total')).toBeInTheDocument();
      expect(screen.getByText('42,850 t')).toBeInTheDocument();
      expect(screen.getByText('71.4% Capacity')).toBeInTheDocument();
      expect(screen.getByText('+1,420 t shift delta')).toBeInTheDocument();

      expect(screen.getByText('Clean Coal Product Stockpile')).toBeInTheDocument();
      expect(screen.getByText('18,640 t')).toBeInTheDocument();
      expect(screen.getByText('62.1% Capacity')).toBeInTheDocument();
      expect(screen.getByText('CV 27.4 MJ/kg')).toBeInTheDocument();

      expect(screen.getByText('Magnetite Medium Reserve')).toBeInTheDocument();
      expect(screen.getByText('148.5 t')).toBeInTheDocument();
      expect(screen.getByText('Silo 1 & 2 Active')).toBeInTheDocument();
      expect(screen.getByText('0.68 kg/t consumption')).toBeInTheDocument();

      expect(screen.getByText('Flocculant & Reagent Autonomy')).toBeInTheDocument();
      expect(screen.getByText('14.2 Days')).toBeInTheDocument();
      expect(screen.getByText('Anionic Floc + Frother')).toBeInTheDocument();
      expect(screen.getByText('All dosing skids nominal')).toBeInTheDocument();
    });

    it('renders the Stockpile & Silo Bay Matrix with all 6 live storage bays', async () => {
      const jsx = await DepartmentDashboard({
        params: Promise.resolve({ department: 'plant-inventory' }),
      });
      render(jsx);

      expect(screen.getByText('Stockpile & Silo Bay Matrix')).toBeInTheDocument();
      expect(screen.getByText('ROM Pad A - High Grade')).toBeInTheDocument();
      expect(screen.getByText('ROM Pad B - Blend')).toBeInTheDocument();
      expect(screen.getByText('Product Stockpile North')).toBeInTheDocument();
      expect(screen.getByText('Magnetite Bulk Silo #1')).toBeInTheDocument();
      expect(screen.getByText('Magnetite Bulk Silo #2')).toBeInTheDocument();
      expect(screen.getByText('Flocculant Mix Tank A')).toBeInTheDocument();
    });

    it('renders the Critical Wear Spares & Screen Media Ledger with stock-on-hand and reorder statuses', async () => {
      const jsx = await DepartmentDashboard({
        params: Promise.resolve({ department: 'plant-inventory' }),
      });
      render(jsx);

      expect(screen.getByText('Critical Wear Spares & Screen Media Ledger')).toBeInTheDocument();
      expect(screen.getByText('Primary Jaw Toggle Plates')).toBeInTheDocument();
      expect(screen.getByText('Banana Screen Polyurethane Panels (32mm)')).toBeInTheDocument();
      expect(screen.getByText('Dense Medium Cyclone Vortex Finders')).toBeInTheDocument();
      expect(screen.getByText('Warman 10/8 Slurry Pump Impellers')).toBeInTheDocument();
      expect(screen.getByText('Reorder Triggered (21d lead)')).toBeInTheDocument();
    });
  });
});
