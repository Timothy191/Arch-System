import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductionMachinesTargetPanel } from './ProductionMachinesTargetPanel';
import {
  DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  type ProductionMachinesTargetReport,
} from './production-types';

const mockReport: ProductionMachinesTargetReport = {
  asOfDate: '2026-11-24',
  activeShiftLabel: 'Day Shift',
  targets: DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  summaryByHorizon: {
    shift: {
      totalFleet: 3,
      meetingCount: 1,
      belowCount: 1,
      idleCount: 1,
      avgAttainmentPct: 48.3,
    },
    daily: {
      totalFleet: 3,
      meetingCount: 1,
      belowCount: 1,
      idleCount: 1,
      avgAttainmentPct: 51.7,
    },
    monthly: {
      totalFleet: 3,
      meetingCount: 2,
      belowCount: 0,
      idleCount: 1,
      avgAttainmentPct: 65.0,
    },
  },
  machines: [
    {
      machineId: 'm-1',
      name: 'ADT-101',
      machineType: 'Haul Truck',
      serialNumber: 'CAT-777G',
      siteName: 'North Pit',
      roleCategory: 'haulage',
      horizons: {
        shift: {
          actualLoads: 80,
          targetLoads: 80,
          actualPitBcm: 1500,
          targetPitBcm: 1450,
          actualRolloverBcm: 0,
          targetRolloverBcm: 0,
          actualHours: 10.5,
          targetHours: 10,
          attainmentPct: 102.5,
          status: 'meeting',
        },
        daily: {
          actualLoads: 165,
          targetLoads: 160,
          actualPitBcm: 3100,
          targetPitBcm: 2900,
          actualRolloverBcm: 0,
          targetRolloverBcm: 0,
          actualHours: 20,
          targetHours: 20,
          attainmentPct: 103.3,
          status: 'meeting',
        },
        monthly: {
          actualLoads: 4900,
          targetLoads: 4800,
          actualPitBcm: 91000,
          targetPitBcm: 87000,
          actualRolloverBcm: 0,
          targetRolloverBcm: 0,
          actualHours: 600,
          targetHours: 600,
          attainmentPct: 102.2,
          status: 'meeting',
        },
      },
    },
    {
      machineId: 'm-2',
      name: 'EX-202',
      machineType: 'Excavator',
      serialNumber: 'SN-984',
      siteName: 'South Pit',
      roleCategory: 'excavation',
      horizons: {
        shift: {
          actualLoads: 40,
          targetLoads: 80,
          actualPitBcm: 740,
          targetPitBcm: 1450,
          actualRolloverBcm: 0,
          targetRolloverBcm: 0,
          actualHours: 5.0,
          targetHours: 10,
          attainmentPct: 42.5,
          status: 'below',
        },
        daily: {
          actualLoads: 90,
          targetLoads: 160,
          actualPitBcm: 1600,
          targetPitBcm: 2900,
          actualRolloverBcm: 0,
          targetRolloverBcm: 0,
          actualHours: 10,
          targetHours: 20,
          attainmentPct: 51.8,
          status: 'below',
        },
        monthly: {
          actualLoads: 4500,
          targetLoads: 4800,
          actualPitBcm: 82000,
          targetPitBcm: 87000,
          actualRolloverBcm: 0,
          targetRolloverBcm: 0,
          actualHours: 560,
          targetHours: 600,
          attainmentPct: 92.8,
          status: 'meeting',
        },
      },
    },
    {
      machineId: 'm-3',
      name: 'DZ-303',
      machineType: 'Dozer',
      serialNumber: 'D10T',
      siteName: 'West Spoil',
      roleCategory: 'dozer',
      horizons: {
        shift: {
          actualLoads: 0,
          targetLoads: 0,
          actualPitBcm: 0,
          targetPitBcm: 650,
          actualRolloverBcm: 0,
          targetRolloverBcm: 650,
          actualHours: 0,
          targetHours: 10,
          attainmentPct: 0,
          status: 'idle',
        },
        daily: {
          actualLoads: 0,
          targetLoads: 0,
          actualPitBcm: 0,
          targetPitBcm: 1300,
          actualRolloverBcm: 0,
          targetRolloverBcm: 1300,
          actualHours: 0,
          targetHours: 20,
          attainmentPct: 0,
          status: 'idle',
        },
        monthly: {
          actualLoads: 0,
          targetLoads: 0,
          actualPitBcm: 0,
          targetPitBcm: 39000,
          actualRolloverBcm: 0,
          targetRolloverBcm: 39000,
          actualHours: 0,
          targetHours: 600,
          attainmentPct: 0,
          status: 'idle',
        },
      },
    },
  ],
};

describe('ProductionMachinesTargetPanel', () => {
  it('renders KPI counts and machine compliance rows for Daily horizon by default', () => {
    render(<ProductionMachinesTargetPanel report={mockReport} />);

    expect(screen.getByText('Production Fleet Target Compliance')).toBeInTheDocument();
    expect(screen.getByText('ADT-101')).toBeInTheDocument();
    expect(screen.getByText('EX-202')).toBeInTheDocument();
    expect(screen.getByText('DZ-303')).toBeInTheDocument();
    expect(screen.getByText('Avg Attainment: 51.7%')).toBeInTheDocument();
    expect(screen.getAllByText('Meeting Target').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Below Target').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Idle / No Data').length).toBeGreaterThanOrEqual(2);
  });

  it('switches horizons and filters fleet by status and search text', () => {
    render(<ProductionMachinesTargetPanel report={mockReport} />);

    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText('Avg Attainment: 65%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Below Target' }));
    expect(screen.getByText(/No production machines match/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All Fleet' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter machines' }), {
      target: { value: 'DZ-303' },
    });
    expect(screen.getByText('DZ-303')).toBeInTheDocument();
    expect(screen.queryByText('ADT-101')).not.toBeInTheDocument();
  });
});
