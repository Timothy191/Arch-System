import { DepartmentLayout } from "@repo/ui/DepartmentLayout";
import { DEPARTMENTS, getDepartmentTabs } from "~/lib/departments";
import { notFound } from "next/navigation";
import type { Department } from "~/lib/departments";
import { ActiveDepartmentSetter } from "@/components/nav/ActiveDepartmentSetter";
import { AIAssistantWrapper } from "@/components/ai/AIAssistantWrapper";

interface DrillingOpsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ department: string }>;
}

export default async function DrillingOperationsLayout({
  children,
  params,
}: DrillingOpsLayoutProps) {
  const { department } = await params;
  const dept = DEPARTMENTS.find((d) => d.name === department);
  if (!dept) notFound();

  const tabs = getDepartmentTabs(department);

  return (
    <>
      <ActiveDepartmentSetter department={department} />
      <DepartmentLayout department={dept as Department} tabs={tabs}>
        {children}
        <AIAssistantWrapper context={`${dept.name} Department`} />
      </DepartmentLayout>
    </>
  );
}
