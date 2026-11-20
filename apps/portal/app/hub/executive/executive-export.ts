import {
  EM_DASH,
  formatNumber,
  formatPercent,
  formatRatio,
  formatTonnes,
} from './executive-format';
import type { ExecutiveData } from './executive-metrics';

const TONNE_DECIMALS = 2;
const RATE_DECIMALS = 2;
const DRIFT_DECIMALS = 1;

const PDF_TABLE_HEADERS = [
  'Date',
  'Coal (t)',
  'Waste (t)',
  'Total Tonnage (t)',
  'Fuel (L)',
  'Hours',
  'Drift %',
];

interface PdfReportData {
  title: string;
  subtitle: string;
  kpis: { label: string; value: string }[];
  tableHeaders: string[];
  tableRows: string[][];
}

function fixed(raw: number, decimals: number): string {
  return raw.toFixed(decimals);
}

export function buildExportRows(data: ExecutiveData): Record<string, string>[] {
  return data.daily.map((point) => ({
    Date: point.date,
    'Coal (t)': fixed(point.coal, TONNE_DECIMALS),
    'Waste (t)': fixed(point.waste, TONNE_DECIMALS),
    'Total (t)': fixed(point.total, TONNE_DECIMALS),
    'Fuel (L)': fixed(point.fuelLitres, TONNE_DECIMALS),
    'Machine Hours (h)': fixed(point.hours, TONNE_DECIMALS),
    'Fuel Efficiency (L/t)':
      point.fuelPerTonne === null ? '' : fixed(point.fuelPerTonne, RATE_DECIMALS),
    'Reconciliation Drift (%)': fixed(point.drift, DRIFT_DECIMALS),
  }));
}

function buildPdfKpis(data: ExecutiveData): PdfReportData['kpis'] {
  const { mtd, fleet, breakdowns, target } = data;
  const fuel = mtd.fuelPerTonne === null ? EM_DASH : formatNumber(mtd.fuelPerTonne, RATE_DECIMALS);
  return [
    { label: 'Total Tonnage', value: formatTonnes(mtd.total) },
    { label: 'Coal Removed', value: formatTonnes(mtd.coal) },
    { label: 'Waste Removed', value: formatTonnes(mtd.waste) },
    { label: 'Strip Ratio', value: formatRatio(mtd.stripRatio) },
    { label: 'Fuel Efficiency', value: `${fuel} L/t` },
    { label: 'Reconciliation Drift', value: formatPercent(mtd.avgAbsDriftPct) },
    { label: 'Fleet Availability', value: formatPercent(fleet.availabilityPct, 0) },
    { label: 'Active Breakdowns', value: formatNumber(breakdowns.open) },
    { label: 'Coal Target Attainment', value: formatPercent(target?.coalAttainmentPct ?? null) },
  ];
}

export function buildPdfReport(data: ExecutiveData): PdfReportData {
  return {
    title: 'Executive Production & Fleet Report',
    subtitle: `Generated on ${data.today} — Month-to-date analysis`,
    kpis: buildPdfKpis(data),
    tableHeaders: [...PDF_TABLE_HEADERS],
    tableRows: data.daily.map((point) => [
      point.date,
      fixed(point.coal, TONNE_DECIMALS),
      fixed(point.waste, TONNE_DECIMALS),
      fixed(point.total, TONNE_DECIMALS),
      fixed(point.fuelLitres, 0),
      fixed(point.hours, DRIFT_DECIMALS),
      `${fixed(point.drift, DRIFT_DECIMALS)}%`,
    ]),
  };
}
