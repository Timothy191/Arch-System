import { DEPARTMENTS, getDepartmentTabs } from "@repo/departments/data-access";
import { DepartmentLayout } from "@repo/ui/DepartmentLayout";
import { notFound } from "next/navigation";
import { AriaLauncher } from "@/components/ai/AriaLauncher";
import { ActiveDepartmentSetter } from "@/components/nav/ActiveDepartmentSetter";

export default async function AccessControlLayout({ children }: { children: React.ReactNode }) {
  const dept = DEPARTMENTS.find((d) => d.name === "access-control");
  if (!dept) notFound();

  const tabs = getDepartmentTabs("access-control");

  return (
    <>
      <ActiveDepartmentSetter department="access-control" />
      <DepartmentLayout department={dept} tabs={tabs}>
        {children}
        <AriaLauncher />
      </DepartmentLayout>
    </>
  );
}
