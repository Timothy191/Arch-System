import { EngineeringWhatsappReportClient } from '../EngineeringWhatsappReportClient';
import { loadEngineeringReportsPayload } from '../load-engineering-reports';

interface EngineeringWhatsappReportPageProps {
  readonly searchParams: Promise<{ range?: string }>;
}

export default async function EngineeringWhatsappReportPage({
  searchParams,
}: EngineeringWhatsappReportPageProps) {
  const { range: rawRange } = await searchParams;
  const payload = await loadEngineeringReportsPayload({
    rawRange,
    initialTab: 'whatsapp-report',
  });

  return <EngineeringWhatsappReportClient payload={payload} />;
}
