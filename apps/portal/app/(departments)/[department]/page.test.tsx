import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DepartmentDashboard from './page';

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest
    .fn()
    .mockImplementation(async ({ department }: { department: string }) => ({
      dept: {
        name: department,
        displayName: department === 'plant-inventory' ? 'Stock Control Department' : 'Department',
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
    it('renders the Stock Dashboard KPI strip with Total Stock Lines, Nominal Stock Levels, Stock Required Alerts, and Equipment Tracked', async () => {
      const jsx = await DepartmentDashboard({
        params: Promise.resolve({ department: 'plant-inventory' }),
      });
      render(jsx);

      expect(screen.getByText('Stock Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Total Stock Lines')).toBeInTheDocument();
      expect(screen.getByText('Nominal Stock Levels')).toBeInTheDocument();
      expect(screen.getByText('Stock Required Alerts')).toBeInTheDocument();
      expect(screen.getByText('Equipment Tracked')).toBeInTheDocument();
      expect(screen.getByText('2026-10-22')).toBeInTheDocument();
    });

    it('renders the Items Requiring Replenishment quick list with below-par equipment stock items', async () => {
      const jsx = await DepartmentDashboard({
        params: Promise.resolve({ department: 'plant-inventory' }),
      });
      render(jsx);

      expect(screen.getByText('Items Requiring Replenishment')).toBeInTheDocument();
      expect(screen.getByText('Magnetite Superfine Medium (96% Fe3O4)')).toBeInTheDocument();
      expect(screen.getByText('MIBC Frother Reagent (IBC Bulk)')).toBeInTheDocument();
      expect(screen.getByText('Dense Medium Cyclone Vortex Finders')).toBeInTheDocument();
      expect(screen.getByText('Warman 10/8 Slurry Pump Impellers')).toBeInTheDocument();
    });

    it('renders the Stock Drawdown by Equipment summary cards for plant equipment', async () => {
      const jsx = await DepartmentDashboard({
        params: Promise.resolve({ department: 'plant-inventory' }),
      });
      render(jsx);

      expect(screen.getByText('Stock Drawdown by Equipment')).toBeInTheDocument();
      expect(screen.getAllByText('Primary DMC Module CR-101').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Secondary Sizing Screen SC-201').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Tailings Thickener TH-501').length).toBeGreaterThan(0);
    });
  });
});
