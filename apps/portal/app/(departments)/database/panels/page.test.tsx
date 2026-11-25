import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DatabasePanelsPage from './page';

const mockGetProvisioningReferenceData = jest.fn();
const mockFetchMasterReferenceSnapshot = jest.fn();

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('@/actions/employee-provisioning', () => ({
  getProvisioningReferenceData: () => mockGetProvisioningReferenceData(),
}));

jest.mock('../department-database-catalog', () => ({
  fetchMasterReferenceSnapshot: () => mockFetchMasterReferenceSnapshot(),
}));

jest.mock('@/components/employee/EmployeeProvisioningForm', () => ({
  EmployeeProvisioningForm: () => <div data-testid="employee-provisioning-form" />,
}));

jest.mock('@/components/employee/EditEmployeeModal', () => ({
  EditEmployeeModal: () => <div data-testid="edit-employee-modal" />,
}));

describe('DatabasePanelsPage (/database/panels)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders cross-department master reference panels alongside personnel provisioning registry', async () => {
    mockGetProvisioningReferenceData.mockResolvedValueOnce({
      departments: [{ id: 'dept-1', name: 'Control Room' }],
      recentPersonnel: [
        {
          id: 'pers-1',
          first_name: 'Thabo',
          surname: 'Mokoena',
          emp_code: 'EMP-001',
          id_number: '9001015000081',
          job_title: 'Excavator Operator',
          area_name: 'Brakfontein Pit',
          medical_expiry: '2028-01-01',
          induction_expiry: '2028-01-01',
          status: 'Active',
          photo_url: null,
          badge: { qr_code: 'QR-001', is_active: true },
        },
      ],
    });

    mockFetchMasterReferenceSnapshot.mockResolvedValueOnce({
      isLiveConnected: true,
      activeSites: [{ name: 'Brakfontein Pit', siteCode: 'BRAK-PIT' }],
      mineBlocksCount: 6,
      mineBlockNames: ['Block A', 'Block B'],
      totalMachines: 58,
      activeMachines: 54,
      machineTypesSummary: ['Excavator (12)', 'Dump Truck (28)'],
      operatorsCount: 24,
      delayCategories: ['Mechanical', 'Waiting on Dumper'],
      materialDensities: [
        { materialType: 'Coal', densityFactor: 1.45 },
        { materialType: 'Waste', densityFactor: 2.2 },
      ],
      monthlyTargetsCount: 4,
      latestTargetMonth: '2026-11',
      plantInventoryItemsCount: 14,
      tiresCount: 48,
      cardPrintersCount: 2,
      cardTemplatesCount: 3,
    });

    const jsx = await DatabasePanelsPage();
    render(jsx);

    expect(
      screen.getByText('Database Control & Cross-Department Reference Panels')
    ).toBeInTheDocument();
    expect(screen.getByTestId('master-reference-console')).toBeInTheDocument();
    expect(screen.getByText('Sites & Mine Blocks')).toBeInTheDocument();
    expect(screen.getByText('Fleet Machinery & Tyres')).toBeInTheDocument();
    expect(screen.getByText('Production Targets & Densities')).toBeInTheDocument();
    expect(screen.getByText(/54 \/ 58 Active Machines/i)).toBeInTheDocument();
    expect(screen.getByText(/BRAK-PIT · Brakfontein Pit/i)).toBeInTheDocument();
    expect(screen.getByText('Thabo Mokoena')).toBeInTheDocument();
  });
});
