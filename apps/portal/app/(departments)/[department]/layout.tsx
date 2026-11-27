import { DEPARTMENTS, getDepartmentTabs } from '@repo/departments/data-access';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';
import { DepartmentVideoBackground } from './DepartmentVideoBackground';

interface DepartmentLayoutProps {
  children: React.ReactNode;
  params: Promise<{ department: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = DEPARTMENTS.find((d) => d.name === department);
  return {
    title: dept ? `${dept.displayName} | Arch OS` : 'Department | Arch OS',
  };
}

export default async function DepartmentRootLayout({ children, params }: DepartmentLayoutProps) {
  const { department } = await params;
  const dept = DEPARTMENTS.find((d) => d.name === department);
  if (!dept) notFound();

  const tabs = getDepartmentTabs(department);

  return (
    <div className="relative min-h-screen">
      <DepartmentVideoBackground department={department} />
      <div className="relative z-10">
        <ActiveDepartmentSetter department={department} />
        <DepartmentLayout department={dept} tabs={tabs}>
          {children}
        </DepartmentLayout>
      </div>
    </div>
  );
}
