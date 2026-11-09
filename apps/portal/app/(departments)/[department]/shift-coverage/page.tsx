import { getCurrentShift } from '@repo/utils';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { ShiftCoverageClient } from './ShiftCoverageClient';

export default async function ShiftCoveragePage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, 'control-room');
  const { deptId, today } = await getDepartmentContext({
    department: deptSlug,
  });

  const initialShift = getCurrentShift();

  return (
    <ShiftCoverageClient
      departmentId={deptId}
      departmentSlug={deptSlug}
      initialDate={today}
      initialShift={initialShift}
    />
  );
}
