import { DEPARTMENTS, getDepartmentTabs } from "@repo/departments/data-access";
import { DepartmentLayout } from "@repo/ui/DepartmentLayout";
import { notFound } from "next/navigation";
import { AriaLauncher } from "@/components/ai/AriaLauncher";
import { ActiveDepartmentSetter } from "@/components/nav/ActiveDepartmentSetter";

export default async function EngineeringLayout({ children }: { children: React.ReactNode }) {
  const dept = DEPARTMENTS.find((d) => d.name === "engineering");
  if (!dept) notFound();

  const tabs = getDepartmentTabs("engineering");

  return (
    <>
      <ActiveDepartmentSetter department="engineering" />
      <DepartmentLayout department={dept} tabs={tabs}>
        {children}
        <AriaLauncher />
      </DepartmentLayout>
    </>
  );
}
