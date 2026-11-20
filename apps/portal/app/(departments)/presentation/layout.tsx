import { DEPARTMENTS, getDepartmentTabs } from '@repo/departments/data-access';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { notFound } from 'next/navigation';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';

export default async function PresentationLayout({ children }: { children: React.ReactNode }) {
  const dept = DEPARTMENTS.find((departmentEntry) => departmentEntry.name === 'presentation');
  if (!dept) notFound();

  const tabs = getDepartmentTabs('presentation');

  return (
    <>
      <ActiveDepartmentSetter department="presentation" />
      <DepartmentLayout department={dept} tabs={tabs}>
        {children}
      </DepartmentLayout>
    </>
  );
}
