import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  C66MachineOperatorScanner,
  getAssignmentCapabilityNote,
  getOperatorPlaceholder,
  isAdtOrDumpTruck,
} from './C66MachineOperatorScanner';

const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

const DEPT_ID = '00000000-0000-4000-8000-000000000001';
const MACHINE_ADT_ID = '00000000-0000-4000-8000-000000000010';
const MACHINE_DOZER_ID = '00000000-0000-4000-8000-000000000011';
const OPERATOR_ID = '00000000-0000-4000-8000-000000000020';
const SITE_ID = '00000000-0000-4000-8000-000000000030';
const OPERATION_ID = '00000000-0000-4000-8000-000000000040';

const mockMachines = [
  {
    id: MACHINE_ADT_ID,
    name: 'ADT-01',
    machine_type: 'Articulated Dump Truck',
    site_id: SITE_ID,
  },
  {
    id: MACHINE_DOZER_ID,
    name: 'DZ-01',
    machine_type: 'Dozer',
    site_id: null,
  },
];

const mockSites = [{ id: SITE_ID, name: 'Pit North' }];

describe('isAdtOrDumpTruck', () => {
  it('identifies ADT, dump, truck, and articulated variants', () => {
    expect(isAdtOrDumpTruck('ADT')).toBe(true);
    expect(isAdtOrDumpTruck('Articulated Dump Truck')).toBe(true);
    expect(isAdtOrDumpTruck('Dump_Truck_40T')).toBe(true);
    expect(isAdtOrDumpTruck('Water Truck')).toBe(true);
  });

  it('returns false for non-truck equipment', () => {
    expect(isAdtOrDumpTruck('Excavator')).toBe(false);
    expect(isAdtOrDumpTruck('Dozer')).toBe(false);
    expect(isAdtOrDumpTruck('Drill Rig')).toBe(false);
  });
});

describe('getOperatorPlaceholder', () => {
  const sampleMachine = {
    id: MACHINE_ADT_ID,
    name: 'ADT-01',
    machineType: 'ADT',
    siteId: SITE_ID,
    requiresHourlyLoads: true,
  };

  it('returns initial prompt when no machine is selected', () => {
    expect(getOperatorPlaceholder(null, false, false, false)).toBe('Choose a machine first…');
  });

  it('returns loading state when operators are being fetched', () => {
    expect(getOperatorPlaceholder(sampleMachine, true, false, true)).toBe(
      'Loading cleared operators…'
    );
  });

  it('returns ADT-specific and generic prompts when operators exist or are empty', () => {
    expect(getOperatorPlaceholder(sampleMachine, false, true, true)).toBe(
      'Choose cleared ADT operator…'
    );
    expect(getOperatorPlaceholder(sampleMachine, false, true, false)).toBe(
      'Choose cleared, matching operator…'
    );
    expect(getOperatorPlaceholder(sampleMachine, false, false, true)).toBe(
      'No cleared ADT operators'
    );
    expect(getOperatorPlaceholder(sampleMachine, false, false, false)).toBe(
      'No cleared type-matched operators'
    );
  });
});

describe('getAssignmentCapabilityNote', () => {
  it('returns hourly loads note when requiresHourlyLoads is true', () => {
    expect(
      getAssignmentCapabilityNote({
        id: MACHINE_ADT_ID,
        name: 'ADT-01',
        machineType: 'ADT',
        siteId: SITE_ID,
        requiresHourlyLoads: true,
      })
    ).toBe(' This machine is included automatically in Hourly Loads.');
  });

  it('returns bench clearance note when tracksBenchClearance is true', () => {
    expect(
      getAssignmentCapabilityNote({
        id: MACHINE_DOZER_ID,
        name: 'DZ-01',
        machineType: 'Dozer',
        siteId: SITE_ID,
        requiresHourlyLoads: false,
        machineCapabilities: {
          requiresHourlyLoads: false,
          tracksTonnage: false,
          tracksCycleTime: false,
          tracksFuel: true,
          tracksBenchClearance: true,
          tracksDrillDepth: false,
        },
      })
    ).toBe(' This machine tracks bench clearance and blade push metrics.');
  });

  it('returns empty string when neither capability is enabled', () => {
    expect(
      getAssignmentCapabilityNote({
        id: MACHINE_DOZER_ID,
        name: 'DZ-01',
        machineType: 'Dozer',
        siteId: SITE_ID,
        requiresHourlyLoads: false,
      })
    ).toBe('');
  });
});

describe('C66MachineOperatorScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders initial state with disabled operator selector', () => {
    render(
      <C66MachineOperatorScanner departmentId={DEPT_ID} machines={mockMachines} sites={mockSites} />
    );

    expect(screen.getByLabelText('Machine')).toHaveValue('');
    expect(screen.getByLabelText('Operator')).toBeDisabled();
    expect(screen.getByText('Choose a machine first…')).toBeInTheDocument();
  });

  it('loads eligible operators when a machine is selected and assigns an operator', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stage: 'operators',
          machine: {
            id: MACHINE_ADT_ID,
            name: 'ADT-01',
            machineType: 'Articulated Dump Truck',
            siteId: SITE_ID,
            requiresHourlyLoads: true,
          },
          operators: [
            {
              id: OPERATOR_ID,
              name: 'Jane Doe',
              jobTitle: 'ADT Operator',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stage: 'assignment',
          machine: {
            id: MACHINE_ADT_ID,
            name: 'ADT-01',
            machineType: 'Articulated Dump Truck',
            siteId: SITE_ID,
            requiresHourlyLoads: true,
          },
          operator: {
            id: OPERATOR_ID,
            name: 'Jane Doe',
          },
          operationId: OPERATION_ID,
          assignedAt: '2026-04-20T08:00:00.000Z',
          alreadyAssigned: false,
          checks: {
            machineActive: true,
            badgeValid: true,
            badgeScanned: false,
            operatorActive: true,
            medicalValid: true,
            inductionValid: true,
            machineQualification: 'not_configured',
          },
        }),
      });

    render(
      <C66MachineOperatorScanner departmentId={DEPT_ID} machines={mockMachines} sites={mockSites} />
    );

    fireEvent.change(screen.getByLabelText('Machine'), {
      target: { value: MACHINE_ADT_ID },
    });

    await waitFor(() => {
      expect(screen.getByText('Jane Doe · ADT Operator')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Operator'), {
      target: { value: OPERATOR_ID },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Assigned: Jane Doe → ADT-01.');
    });
    expect(mockRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    expect(screen.getByLabelText('Machine')).toHaveValue('');
  });

  it('displays error alert when operator loading fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Unable to fetch operators for this machine.',
      }),
    });

    render(
      <C66MachineOperatorScanner departmentId={DEPT_ID} machines={mockMachines} sites={mockSites} />
    );

    fireEvent.change(screen.getByLabelText('Machine'), {
      target: { value: MACHINE_DOZER_ID },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to fetch operators for this machine.'
      );
    });
  });
});
