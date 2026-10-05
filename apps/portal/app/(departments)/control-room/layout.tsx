import { DEPARTMENTS, getDepartmentTabs } from '@repo/departments/data-access';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AriaLauncher } from '@/components/ai/AriaLauncher';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';

export async function generateMetadata(): Promise<Metadata> {
  const dept = DEPARTMENTS.find((d) => d.name === 'control-room');
  return {
    title: dept ? `${dept.displayName} | Arch OS` : 'Control Room | Arch OS',
  };
}

export default async function ControlRoomLayout({ children }: { children: React.ReactNode }) {
  const dept = DEPARTMENTS.find((d) => d.name === 'control-room');
  if (!dept) notFound();

  const tabs = getDepartmentTabs('control-room');

  return (
    <>
      <ActiveDepartmentSetter department="control-room" />
      <DepartmentLayout department={dept} tabs={tabs}>
        {children}
        <AriaLauncher />
      </DepartmentLayout>
    </>
  );
}
