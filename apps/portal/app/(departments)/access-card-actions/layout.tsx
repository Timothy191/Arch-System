import { DEPARTMENTS, getDepartmentTabs } from "@repo/departments/data-access";
import { DepartmentLayout } from "@repo/ui/DepartmentLayout";
import { notFound } from "next/navigation";
import { AriaLauncher } from "@/components/ai/AriaLauncher";
import { ActiveDepartmentSetter } from "@/components/nav/ActiveDepartmentSetter";

export default async function AccessCardActionsLayout({ children }: { children: React.ReactNode }) {
  const dept = DEPARTMENTS.find((d) => d.name === "access-card-actions");
  if (!dept) notFound();

  const tabs = getDepartmentTabs("access-card-actions");

  return (
    <>
      <ActiveDepartmentSetter department="access-card-actions" />
      <DepartmentLayout department={dept} tabs={tabs}>
        {children}
        <AriaLauncher />
      </DepartmentLayout>
    </>
  );
}
