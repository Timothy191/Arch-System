import { computeArchivedReportData } from './reports-analytics-helpers';
import type { ShiftReportRow } from './reports-types';

describe('reports-analytics-helpers — computeArchivedReportData and core aggregation logic', () => {
  const sampleShiftRows: ShiftReportRow[] = [
    {
      id: 'row-1',
      site: 'Pit Alpha',
      date: '2026-09-15',
      shift: 'day',
      hours: 10,
      loads: 20,
      haulBcm: 500,
      dozerRolloverBcm: 1000,
      totalBcm: 1500,
      delayMin: 30,
      dozerPasses: 25,
      fuelLitres: 400,
      coalTonnes: 300,
      wasteTonnes: 200,
      notes: 'Good blast progression',
    },
    {
      id: 'row-2',
      site: 'Pit Beta',
      date: '2026-09-16',
      shift: 'night',
      hours: 8,
      loads: 15,
      haulBcm: 300,
      dozerRolloverBcm: 500,
      totalBcm: 800,
      delayMin: 15,
      dozerPasses: 10,
      fuelLitres: 250,
      coalTonnes: 150,
      wasteTonnes: 100,
      notes: 'Rain delay',
    },
    {
      id: 'row-3',
      site: 'Pit Alpha',
      date: '2026-10-01',
      shift: 'day',
      hours: 12,
      loads: 30,
      haulBcm: 800,
      dozerRolloverBcm: 1200,
      totalBcm: 2000,
      delayMin: 45,
      dozerPasses: 30,
      fuelLitres: 600,
      coalTonnes: 500,
      wasteTonnes: 300,
      notes: 'Steady haulage',
    },
    {
      id: 'row-4',
      site: 'Pit Beta',
      date: '2026-10-05',
      shift: 'night',
      hours: 6,
      loads: 10,
      haulBcm: 200,
      dozerRolloverBcm: 400,
      totalBcm: 600,
      delayMin: 60,
      dozerPasses: 8,
      fuelLitres: 200,
      coalTonnes: 100,
      wasteTonnes: 80,
      notes: 'Cable maintenance',
    },
  ];

  it('aggregates archived shift rows into monthly rollups and prior days in a single pass', () => {
    const todayStr = '2026-10-05';
    const result = computeArchivedReportData(sampleShiftRows, 'all', 'all', '', todayStr);

    expect(result.historicalRows).toHaveLength(4);
    expect(result.priorDaysRows).toHaveLength(3);
    expect(result.priorDaysRows.map((r) => r.id)).toEqual(['row-1', 'row-2', 'row-3']);

    expect(result.monthlyRollups).toHaveLength(2);
    expect(result.monthlyRollups[0]?.month).toBe('2026-10');
    expect(result.monthlyRollups[0]?.shiftCount).toBe(2);
    expect(result.monthlyRollups[0]?.hours).toBe(18);
    expect(result.monthlyRollups[0]?.totalBcm).toBe(2600);
    expect(result.monthlyRollups[0]?.delayMin).toBe(105);

    expect(result.monthlyRollups[1]?.month).toBe('2026-09');
    expect(result.monthlyRollups[1]?.shiftCount).toBe(2);
    expect(result.monthlyRollups[1]?.hours).toBe(18);
    expect(result.monthlyRollups[1]?.totalBcm).toBe(2300);
    expect(result.monthlyRollups[1]?.delayMin).toBe(45);
  });

  it('correctly filters by shiftFilter, siteFilter, and searchQuery during single pass', () => {
    const todayStr = '2026-10-05';

    const dayResult = computeArchivedReportData(sampleShiftRows, 'day', 'all', '', todayStr);
    expect(dayResult.historicalRows).toHaveLength(2);
    expect(dayResult.historicalRows.every((r) => r.shift === 'day')).toBe(true);

    const betaResult = computeArchivedReportData(sampleShiftRows, 'all', 'Pit Beta', '', todayStr);
    expect(betaResult.historicalRows).toHaveLength(2);
    expect(betaResult.historicalRows.every((r) => r.site === 'Pit Beta')).toBe(true);

    const queryResult = computeArchivedReportData(sampleShiftRows, 'all', 'all', 'rain', todayStr);
    expect(queryResult.historicalRows).toHaveLength(1);
    expect(queryResult.historicalRows[0]?.id).toBe('row-2');
  });

  it('returns empty collections when input rows array is empty', () => {
    const result = computeArchivedReportData([], 'all', 'all', '', '2026-10-05');
    expect(result.historicalRows).toEqual([]);
    expect(result.monthlyRollups).toEqual([]);
    expect(result.priorDaysRows).toEqual([]);
  });
});
