import ToolsPageClient from "~/features/departments/components/tools/ToolsPageClient";
import { getDepartmentContext } from "~/lib/dept-context";
import { EXTERNAL_TOOLS } from "~/lib/tools";

export default async function ToolsPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = await params;
  const { dept } = await getDepartmentContext({ department });

  const initialTools = EXTERNAL_TOOLS.map((tool) => ({
    ...tool,
    status: "unknown" as const,
  }));

  return <ToolsPageClient departmentName={dept.name} initialTools={initialTools} />;
}
