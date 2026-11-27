import { EngineeringPdfReportClient } from '../EngineeringPdfReportClient';
import { loadEngineeringReportsPayload } from '../load-engineering-reports';

interface EngineeringPdfReportPageProps {
  readonly searchParams: Promise<{ range?: string }>;
}

export default async function EngineeringPdfReportPage({
  searchParams,
}: EngineeringPdfReportPageProps) {
  const { range: rawRange } = await searchParams;
  const payload = await loadEngineeringReportsPayload({
    rawRange,
    initialTab: 'pdf-report',
  });

  return <EngineeringPdfReportClient payload={payload} />;
}
