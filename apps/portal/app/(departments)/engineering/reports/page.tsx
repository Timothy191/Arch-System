import { redirect } from 'next/navigation';
import { EngineeringDashboardReportClient } from './EngineeringDashboardReportClient';
import {
  resolveEngineeringReportRange,
  resolveEngineeringReportTab,
} from './engineering-reports-model';
import { loadEngineeringReportsPayload } from './load-engineering-reports';

interface EngineeringReportsPageProps {
  readonly searchParams: Promise<{ tab?: string; range?: string }>;
}

export default async function EngineeringReportsPage({
  searchParams,
}: EngineeringReportsPageProps) {
  const { tab: rawTab, range: rawRange } = await searchParams;
  const resolvedTab = resolveEngineeringReportTab(rawTab);
  const range = resolveEngineeringReportRange(rawRange);

  if (resolvedTab === 'pdf-report') {
    redirect(`/engineering/reports/pdf?range=${range}`);
  }
  if (resolvedTab === 'whatsapp-report') {
    redirect(`/engineering/reports/whatsapp?range=${range}`);
  }

  const payload = await loadEngineeringReportsPayload({
    rawRange,
    initialTab: 'dashboard',
  });

  return <EngineeringDashboardReportClient payload={payload} />;
}
