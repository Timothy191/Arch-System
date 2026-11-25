import { connection } from 'next/server';
import { getDepartmentContext } from '~/lib/dept-context';
import { getVisitorsForDepartment } from '../actions';
import { autoExitOverdueVisitors } from './actions';
import { VisitorsRegistryClient } from './VisitorsRegistryClient';

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '50', 10);

  const { deptId } = await getDepartmentContext({
    department: 'access-control',
  });

  const { autoExited: initialAutoExited } = await autoExitOverdueVisitors(deptId, {
    skipRevalidate: true,
  });

  const { visitors, totalCount } = await getVisitorsForDepartment(deptId, page, pageSize);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gold-steel-border gold-steel-border-slim !bg-none !bg-white flex items-center justify-between rounded-2xl border border-accent-gold/70 p-5 shadow-sm">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Visitor Management</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Register guests, assign temporary credentials, and enforce 12-hour automatic exit.
          </p>
        </div>
      </div>

      <VisitorsRegistryClient
        visitors={visitors}
        initialAutoExited={initialAutoExited}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        deptId={deptId}
      />
    </div>
  );
}
