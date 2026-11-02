import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import type { MachineOperationLogItem } from './reports-types';
import { ShiftReportA4Preview } from './ShiftReportA4Preview';
import {
  buildExecutiveSummary,
  buildHaulingRow,
  buildSiteShiftReports,
  resolveMaterialConfig,
} from './shift-report-model';

jest.mock('@/styles/print-report.css', () => ({}));

jest.mock('@react-pdf/renderer', () => {
  const ReactLib = require('react');
  return {
    Document: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="shift-pdf-doc">{children}</div>
    ),
    Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    StyleSheet: { create: (styles: unknown) => styles },
    pdf: jest.fn(() => ({
      toBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
    })),
  };
});

describe('ShiftReportA4Preview Component & Calculation Engine', () => {
  const mockOperations: MachineOperationLogItem[] = [
    {
      id: 'op-exc-01',
      date: '2026-11-02',
      shift: 'day',
      machineName: 'EX-01 Liebherr 984',
      machineType: 'Hydraulic Excavator',
      operatorName: 'J. Smith',
      siteName: 'Pit North Bench 3',
      startSmu: 12000.0,
      endSmu: 12009.5,
      hoursWorked: 9.5,
      bcmMoved: 0,
      isDozer: false,
      delayMinutes: 20,
      productionDelayMinutes: 20,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 0,
      status: 'completed',
      siteGroupRole: 'excavator',
      material: 'ROM Coal',
      blockMined: 'SS-07 North Face',
    },
    {
      id: 'op-adt-01',
      date: '2026-11-02',
      shift: 'day',
      machineName: 'ADT-101 Bell B40E',
      machineType: 'ADT Hauler',
      operatorName: 'K. Ndlovu',
      siteName: 'Pit North Bench 3',
      startSmu: 4500.0,
      endSmu: 4508.5,
      hoursWorked: 8.5,
      bcmMoved: 0,
      loadsCount: 20,
      isDozer: false,
      delayMinutes: 0,
      productionDelayMinutes: 0,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 0,
      status: 'completed',
      assignedExcavatorName: 'EX-01 Liebherr 984',
    },
    {
      id: 'op-adt-02',
      date: '2026-11-02',
      shift: 'day',
      machineName: 'ADT-102 Bell B40E',
      machineType: 'ADT Hauler',
      operatorName: 'T. Van Zyl',
      siteName: 'Pit North Bench 3',
      startSmu: 5100.0,
      endSmu: 5108.0,
      hoursWorked: 8.0,
      bcmMoved: 0,
      loadsCount: 15,
      isDozer: false,
      delayMinutes: 35,
      productionDelayMinutes: 0,
      engineeringDelayMinutes: 35,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 0,
      status: 'completed',
      assignedExcavatorName: 'EX-01 Liebherr 984',
    },
    {
      id: 'op-dozer-01',
      date: '2026-11-02',
      shift: 'day',
      machineName: 'DZ-02 CAT D9R',
      machineType: 'Crawler Track Dozer',
      operatorName: 'P. Moyo',
      siteName: 'Pit North Bench 3',
      startSmu: 8200.0,
      endSmu: 8208.0,
      hoursWorked: 8.0,
      bcmMoved: 2000,
      bladePasses: 48,
      isDozer: true,
      delayMinutes: 15,
      status: 'completed',
      siteGroupRole: 'rollover',
    },
    {
      id: 'op-exc-02',
      date: '2026-11-02',
      shift: 'day',
      machineName: 'EX-02 CAT 390D',
      machineType: 'Hydraulic Excavator',
      operatorName: 'A. Botha',
      siteName: 'South Pit Cut 4',
      startSmu: 9100.0,
      endSmu: 9109.0,
      hoursWorked: 9.0,
      bcmMoved: 0,
      isDozer: false,
      delayMinutes: 0,
      status: 'completed',
      siteGroupRole: 'excavator',
      material: 'Overburden',
      blockMined: 'OB-South-B2',
    },
    {
      id: 'op-truck-03',
      date: '2026-11-02',
      shift: 'day',
      machineName: 'DT-201 CAT 777D',
      machineType: 'Rigid Haul Truck CAT 777',
      operatorName: 'L. Zulu',
      siteName: 'South Pit Cut 4',
      startSmu: 3000.0,
      endSmu: 3008.5,
      hoursWorked: 8.5,
      bcmMoved: 0,
      loadsCount: 25,
      isDozer: false,
      delayMinutes: 0,
      status: 'completed',
      assignedExcavatorName: 'EX-02 CAT 390D',
    },
  ];

  it('correctly resolves Material-Driven Bin Factors and units', () => {
    // ROM Coal for ADT
    const romCoalAdt = resolveMaterialConfig('ROM Coal', 'ADT Hauler');
    expect(romCoalAdt.unit).toBe('Tonnes');
    expect(romCoalAdt.defaultFactor).toBe(28.0);

    // ROM Coal for CAT 777 rigid hauler
    const romCoalRigid = resolveMaterialConfig('ROM Coal', 'CAT 777D Rigid');
    expect(romCoalRigid.unit).toBe('Tonnes');
    expect(romCoalRigid.defaultFactor).toBe(34.0);

    // Overburden for CAT 777
    const obRigid = resolveMaterialConfig('Overburden', 'CAT 777D');
    expect(obRigid.unit).toBe('BCM');
    expect(obRigid.defaultFactor).toBe(18.0);

    // Overburden for ADT
    const obAdt = resolveMaterialConfig('Overburden', 'ADT Bell B40E');
    expect(obAdt.unit).toBe('BCM');
    expect(obAdt.defaultFactor).toBe(12.0);

    // Topsoil
    const topsoil = resolveMaterialConfig('Topsoil', 'ADT Hauler');
    expect(topsoil.unit).toBe('BCM');
    expect(topsoil.defaultFactor).toBe(14.0);

    // Discard
    const discard = resolveMaterialConfig('Discard Waste', 'ADT Hauler');
    expect(discard.unit).toBe('Tonnes');
    expect(discard.defaultFactor).toBe(26.0);
  });

  it('calculates row-level SMR, bin factors, and row totals accurately', () => {
    const haulerRow = buildHaulingRow({
      log: mockOperations[1]!,
      fallbackMaterial: 'ROM Coal',
    });

    expect(haulerRow.machineName).toBe('ADT-101 Bell B40E');
    expect(haulerRow.openingSmr).toBe(4500.0);
    expect(haulerRow.closingSmr).toBe(4508.5);
    expect(haulerRow.totalSmrWorked).toBe(8.5);
    expect(haulerRow.loads).toBe(20);
    expect(haulerRow.materialUnit).toBe('Tonnes');
    expect(haulerRow.binFactor).toBe(28.0);
    // Row Total = 20 loads * 28.0 factor = 560.0 Tonnes
    expect(haulerRow.rowTotal).toBe(560.0);
    expect(haulerRow.delaysDisplay).toBe('-');
  });

  it('formats active delays and preserves 0 delays as clean -', () => {
    const activeDelayRow = buildHaulingRow({
      log: mockOperations[2]!,
      fallbackMaterial: 'ROM Coal',
    });

    expect(activeDelayRow.delayMinutes).toBe(35);
    expect(activeDelayRow.engineeringDelayMinutes).toBe(35);
    expect(activeDelayRow.delaysDisplay).toBe('Eng / Mech (35m)');
  });

  it('auto-aggregates excavator totals and calculates average hauler SMR (zero operator math)', () => {
    const siteReports = buildSiteShiftReports(mockOperations);
    expect(siteReports.length).toBe(2);

    const pitNorth = siteReports.find((s) => s.siteName.includes('Pit North'));
    expect(pitNorth).toBeDefined();

    const excBlock = pitNorth!.excavatorBlocks[0]!;
    expect(excBlock.excavatorName).toBe('EX-01 Liebherr 984');
    expect(excBlock.material).toBe('ROM Coal');
    expect(excBlock.materialUnit).toBe('Tonnes');
    expect(excBlock.assignedMachines.length).toBe(2);

    // Total Loads = 20 (ADT-101) + 15 (ADT-102) = 35 loads
    expect(excBlock.autoTotals.totalLoads).toBe(35);
    // Row 1 = 20 * 28 = 560; Row 2 = 15 * 28 = 420; Total = 980 Tonnes
    expect(excBlock.autoTotals.totalMaterialMoved).toBe(980.0);
    // Average SMR = (8.5 + 8.0) / 2 = 8.25 => formatted to 1 decimal place: 8.3 hrs
    expect(excBlock.autoTotals.averageHaulerSmr).toBe(8.3);

    // Check Categorized Delays Grid:
    // Production: 20m from excavator
    expect(excBlock.delaysGrid.production.totalMins).toBe(20);
    // Engineering: 35m from ADT-102
    expect(excBlock.delaysGrid.engineering.totalMins).toBe(35);
    // Standard Allowances pre-populated: 30 + 15 + 30 = 75m
    expect(excBlock.delaysGrid.standard.totalMins).toBe(75);
    expect(excBlock.delaysGrid.standard.items.map((i) => i.name)).toEqual([
      'Refueling Setup',
      'Daily Pre-Start Inspection',
      'Shift Change & Greasing / Service',
    ]);
  });

  it('guarantees Page 1 Executive Summary dynamically matches sum of Pages 2+ site blocks', () => {
    const siteReports = buildSiteShiftReports(mockOperations);
    const summary = buildExecutiveSummary({
      siteReports,
      departmentName: 'Control Room Operations',
      reportDate: '2026-11-02',
      shift: 'day',
      periodLabel: '2026-11-02 to 2026-11-02',
    });

    const expectedTotalLoads = siteReports.reduce((sum, s) => sum + s.siteTotals.totalLoads, 0);
    const expectedTotalMaterial = siteReports.reduce(
      (sum, s) => sum + s.siteTotals.totalMaterialMoved,
      0
    );

    expect(summary.totalLoads).toBe(expectedTotalLoads);
    expect(summary.totalMaterialMoved).toBe(expectedTotalMaterial);
    expect(summary.productionBySite.length).toBe(siteReports.length);
  });

  it('renders the complete live A4 PDF Page Preview with branding, charts, toolbar and pages', () => {
    render(
      <ShiftReportA4Preview
        departmentId="control-room"
        departmentName="Control Room"
        todayStr="2026-11-02"
        currentShift="day"
        fromDateStr="2026-11-02"
        toDateStr="2026-11-02"
        filteredMachineOps={mockOperations}
      />
    );

    // Verify root preview container exists
    const root = screen.getByTestId('shift-report-a4-preview-root');
    expect(root).toBeInTheDocument();

    // Verify Toolbar controls
    expect(within(root).getByText(/Live A4 PDF Preview/i)).toBeInTheDocument();
    expect(within(root).getByRole('button', { name: /Single Page/i })).toBeInTheDocument();
    expect(within(root).getByRole('button', { name: /All Pages/i })).toBeInTheDocument();
    expect(within(root).getByRole('button', { name: /Export PDF/i })).toBeInTheDocument();
    expect(within(root).getByRole('button', { name: /Print Direct/i })).toBeInTheDocument();

    // Page 1: Verify Arch-Systems corporate branding
    expect(within(root).getByText(/ARCH OS/i)).toBeInTheDocument();
    expect(within(root).getByText(/Plantcor Mining Operations/i)).toBeInTheDocument();
    expect(within(root).getByText(/Official Shift Operations Report/i)).toBeInTheDocument();
    expect(within(root).getByText(/Combined Shift Summary/i)).toBeInTheDocument();

    // Page 1: Verify 3 minimalist summary charts
    expect(within(root).getByText(/1\. Production Volume by Site/i)).toBeInTheDocument();
    expect(within(root).getByText(/2\. Material Distribution Split/i)).toBeInTheDocument();
    expect(
      within(root).getByText(/3\. Operational Utilization & Downtime Breakdown/i)
    ).toBeInTheDocument();

    // Page navigation: switch to Page 2
    const nextBtn = within(root).getByRole('button', { name: /Next Page/i });
    fireEvent.click(nextBtn);

    // Verify Site Breakdown renders on Page 2
    expect(within(root).getByText(/SITE: Pit North Bench 3/i)).toBeInTheDocument();
    expect(within(root).getByText('EX-01 Liebherr 984')).toBeInTheDocument();
    expect(within(root).getByText('ROM Coal')).toBeInTheDocument();
    expect(within(root).getByText(/SS-07 North Face/i)).toBeInTheDocument();

    // Verify Assigned Hauling Machines table headers
    expect(within(root).getByRole('columnheader', { name: 'Machine ID' })).toBeInTheDocument();
    expect(within(root).getByRole('columnheader', { name: 'Bin Factor' })).toBeInTheDocument();
    expect(
      within(root).getByRole('columnheader', { name: 'Total SMR Worked' })
    ).toBeInTheDocument();
    expect(
      within(root).getAllByRole('columnheader', { name: 'Operator' }).length
    ).toBeGreaterThanOrEqual(1);
    expect(within(root).getByRole('columnheader', { name: 'Loads' })).toBeInTheDocument();
    expect(
      within(root).getByRole('columnheader', { name: /Total \(Tonnes\)/i })
    ).toBeInTheDocument();
    expect(
      within(root).getAllByRole('columnheader', { name: 'Delays' }).length
    ).toBeGreaterThanOrEqual(1);

    // Verify hauler rows
    expect(within(root).getByText('ADT-101 Bell B40E')).toBeInTheDocument();
    expect(within(root).getByText('K. Ndlovu')).toBeInTheDocument();
    expect(within(root).getByText('8.5 hrs')).toBeInTheDocument();

    // Verify Auto-Calculated Excavator Totals footer
    expect(within(root).getByText(/Auto-Calculated Excavator Totals:/i)).toBeInTheDocument();

    // Verify Categorized Delays Grid
    expect(within(root).getByText('Production')).toBeInTheDocument();
    expect(within(root).getByText('Engineering')).toBeInTheDocument();
    expect(within(root).getByText('Weather / External')).toBeInTheDocument();
    expect(within(root).getByText('Standard Allowances')).toBeInTheDocument();
    expect(within(root).getByText('Refueling Setup')).toBeInTheDocument();
    expect(within(root).getByText('Daily Pre-Start Inspection')).toBeInTheDocument();

    // Verify Dozer Rollover table
    expect(within(root).getByText(/Dozer Roll-Over Operations/i)).toBeInTheDocument();
    expect(within(root).getByText('DZ-02 CAT D9R')).toBeInTheDocument();
  });

  it('triggers window.print when Print Direct is clicked', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
    render(
      <ShiftReportA4Preview
        departmentId="control-room"
        departmentName="Control Room"
        todayStr="2026-11-02"
        currentShift="day"
        fromDateStr="2026-11-02"
        toDateStr="2026-11-02"
        filteredMachineOps={mockOperations}
      />
    );

    const printBtn = screen.getByRole('button', { name: /Print Direct/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
