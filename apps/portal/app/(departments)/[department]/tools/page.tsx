import { redirect } from 'next/navigation';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import {
  DOCUMENTS_ACTIONS,
  GoogleWorkspacePanel,
  type GoogleWorkspaceService,
  SCHEDULE_ACTIONS,
  type WorkspaceAction,
} from '~/features/departments/components/tools/GoogleWorkspacePanel';
import ToolsPageClient from '~/features/departments/components/tools/ToolsPageClient';
import { getDepartmentContext } from '~/lib/dept-context';
import { getSiteCalendarEmbedUrl, SITE_CALENDAR_EMBED_SRC } from '~/lib/google-workspace';
import { EXTERNAL_TOOLS } from '~/lib/tools';

interface WorkspaceTabConfig {
  readonly service: GoogleWorkspaceService;
  readonly actions: readonly WorkspaceAction[];
  readonly embedUrl: string | null;
}

/**
 * Productivity tabs that hand off to Google Workspace. The system menu and the
 * Tools dropdown link here with `?tab=documents` / `?tab=schedule`; before this
 * map existed the query string was ignored and every entry rendered the same
 * generic tools page.
 */
const GOOGLE_WORKSPACE_TABS: Readonly<Record<string, WorkspaceTabConfig>> = {
  documents: {
    service: 'docs',
    actions: DOCUMENTS_ACTIONS,
    embedUrl: null,
  },
  schedule: {
    service: 'calendar',
    actions: SCHEDULE_ACTIONS,
    embedUrl: getSiteCalendarEmbedUrl(SITE_CALENDAR_EMBED_SRC),
  },
};

export default async function ToolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { department } = await params;
  if (department === 'plant-processing') {
    redirect('/plant-processing');
  }

  const { tab: rawTab } = await searchParams;
  const activeTab = typeof rawTab === 'string' ? rawTab : null;
  const workspaceTab = activeTab ? (GOOGLE_WORKSPACE_TABS[activeTab] ?? null) : null;

  if (workspaceTab) {
    return (
      <GoogleWorkspacePanel
        service={workspaceTab.service}
        actions={workspaceTab.actions}
        embedUrl={workspaceTab.embedUrl}
      />
    );
  }

  const { dept, today } = await getDepartmentContext({ department });
  if (department === 'plant-inventory') {
    return <PlantInventoryWorkspaceClient mode="history-of-used" today={today} />;
  }

  const initialTools = EXTERNAL_TOOLS.map((tool) => ({
    ...tool,
    status: 'unknown' as const,
  }));

  return <ToolsPageClient departmentName={dept.name} initialTools={initialTools} />;
}
