import { connection } from 'next/server';
import { getDepartmentContext } from '~/lib/dept-context';
import { getAccessReportsData } from '../actions';
import {
  type AccessReportRange,
  AccessReportsStudio,
  type AccessReportTab,
} from './access-reports-studio';

interface AccessControlReportsPageProps {
  readonly searchParams?: Promise<{ tab?: string; range?: string }>;
}

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

function resolveAccessReportTab(tabParam?: string): AccessReportTab {
  if (tabParam === 'pdf-report' || tabParam === 'pdf') {
    return 'pdf-report';
  }
  if (tabParam === 'whatsapp-report' || tabParam === 'whatsapp') {
    return 'whatsapp-report';
  }
  return 'dashboard';
}

function resolveAccessReportRange(rangeParam?: string): AccessReportRange | undefined {
  if (rangeParam === 'today' || rangeParam === '7days' || rangeParam === '30days') {
    return rangeParam;
  }
  return undefined;
}

function shiftIsoDate(baseIsoDate: string, daysBack: number): string {
  const anchor = new Date(`${baseIsoDate}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime())) {
    return baseIsoDate;
  }
  return new Date(anchor.getTime() - daysBack * MS_PER_DAY).toISOString().slice(0, 10);
}

function resolveQueryWindow(
  range: AccessReportRange,
  reportDate: string
): { readonly startDate: string; readonly endDate: string } {
  if (range === 'today') {
    return { startDate: reportDate, endDate: reportDate };
  }
  if (range === '30days') {
    return { startDate: shiftIsoDate(reportDate, DAYS_IN_MONTH), endDate: reportDate };
  }
  return { startDate: shiftIsoDate(reportDate, DAYS_IN_WEEK), endDate: reportDate };
}

export default async function AccessControlReportsPage({
  searchParams,
}: AccessControlReportsPageProps = {}) {
  await connection();
  const resolvedParams = searchParams ? await searchParams : {};
  const { deptId, today } = await getDepartmentContext({
    department: 'access-control',
  });

  const reportDate = today || new Date().toISOString().slice(0, 10);
  const initialTab = resolveAccessReportTab(resolvedParams.tab);
  const effectiveRange = resolveAccessReportRange(resolvedParams.range) ?? '7days';
  const { startDate, endDate } = resolveQueryWindow(effectiveRange, reportDate);
  const reportsData = await getAccessReportsData(deptId, startDate, endDate);

  return (
    <AccessReportsStudio
      initialData={reportsData}
      initialTab={initialTab}
      initialRange={effectiveRange}
      reportDate={reportDate}
    />
  );
}
