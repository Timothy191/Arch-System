'use client';

import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { cn } from '@repo/ui/lib/utils';
import { BarChart3, Download, FileText, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  buildEngineeringCsvContent,
  type EngineeringReportRange,
  type EngineeringReportsPayload,
  type EngineeringReportTab,
} from './engineering-reports-model';

interface EngineeringReportsNavProps {
  readonly payload: EngineeringReportsPayload;
  readonly activeRoute: EngineeringReportTab;
}

const TAB_BTN_BASE =
  'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold text-xs transition-colors';
const TAB_BTN_ACTIVE =
  'gold-steel-border gold-steel-border-slim bg-[var(--accent-blue)] text-white shadow-xs';
const TAB_BTN_INACTIVE =
  'border border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]';
const RANGE_PILL_BASE = 'rounded-md px-3 py-1 font-semibold text-xs transition-colors';

const RANGE_OPTIONS: readonly { id: EngineeringReportRange; label: string }[] = [
  { id: '24h', label: '24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
];

const ROUTE_PATHS: Readonly<Record<EngineeringReportTab, string>> = {
  dashboard: '/engineering/reports',
  'pdf-report': '/engineering/reports/pdf',
  'whatsapp-report': '/engineering/reports/whatsapp',
};

export function EngineeringReportsNav({ payload, activeRoute }: EngineeringReportsNavProps) {
  const router = useRouter();
  const basePath = ROUTE_PATHS[activeRoute];

  const handleSelectRange = (nextRange: EngineeringReportRange) => {
    router.push(`${basePath}?range=${nextRange}`);
  };

  const handleExportCsv = () => {
    const csvText = buildEngineeringCsvContent(payload);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `engineering-report-${payload.range}-${payload.todayStr}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Engineering CSV report downloaded.');
  };

  return (
    <GoldenPanel
      showLogo
      variant="elevated"
      headingLevel="h2"
      title="Engineering Reports & Dispatch Suite"
      subtitle={`Window: ${payload.fromDateStr} to ${payload.toDateStr} (${payload.rangeLabel}) · Fleet availability, breakdowns, tire health, and machine hours`}
      className="no-print"
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1"
            aria-label="Report Time Range"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectRange(opt.id)}
                aria-pressed={payload.range === opt.id}
                className={cn(
                  RANGE_PILL_BASE,
                  payload.range === opt.id
                    ? 'bg-white text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3.5 py-2 font-semibold text-[var(--text-heading)] text-xs shadow-2xs hover:bg-[var(--bg-secondary)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      }
    >
      <nav aria-label="Engineering report types" className="flex flex-wrap items-center gap-2">
        <Link
          href={`/engineering/reports?range=${payload.range}`}
          aria-current={activeRoute === 'dashboard' ? 'page' : undefined}
          className={cn(
            TAB_BTN_BASE,
            activeRoute === 'dashboard' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Dashboard</span>
        </Link>

        <Link
          href={`/engineering/reports/pdf?range=${payload.range}`}
          aria-current={activeRoute === 'pdf-report' ? 'page' : undefined}
          className={cn(
            TAB_BTN_BASE,
            activeRoute === 'pdf-report' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE
          )}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>PDF Report</span>
        </Link>

        <Link
          href={`/engineering/reports/whatsapp?range=${payload.range}`}
          aria-current={activeRoute === 'whatsapp-report' ? 'page' : undefined}
          className={cn(
            TAB_BTN_BASE,
            activeRoute === 'whatsapp-report' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          <span>WhatsApp Report</span>
        </Link>
      </nav>
    </GoldenPanel>
  );
}
