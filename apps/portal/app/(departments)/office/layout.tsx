import { DEPARTMENTS, getDepartmentTabs } from '@repo/departments/data-access';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { notFound } from 'next/navigation';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const dept = DEPARTMENTS.find((departmentEntry) => departmentEntry.name === 'office');
  if (!dept) notFound();

  const tabs = getDepartmentTabs('office');

  return (
    <>
      <ActiveDepartmentSetter department="office" />
      <DepartmentLayout department={dept} tabs={tabs}>
        {children}
      </DepartmentLayout>
    </>
  );
}
