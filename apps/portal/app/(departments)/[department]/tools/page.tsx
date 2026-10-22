import { redirect } from 'next/navigation';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import ToolsPageClient from '~/features/departments/components/tools/ToolsPageClient';
import { getDepartmentContext } from '~/lib/dept-context';
import { EXTERNAL_TOOLS } from '~/lib/tools';

export default async function ToolsPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = await params;
  if (department === 'plant-processing') {
    redirect('/plant-processing');
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
