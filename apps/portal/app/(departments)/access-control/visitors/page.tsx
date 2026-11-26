import { GlassCard } from '@repo/ui/GlassCard';
import { connection } from 'next/server';
import { getDeptId } from '@/lib/dept-registry';
import { getDepartmentContext } from '~/lib/dept-context';
import { getVisitorsForDepartment } from '../actions';
import { VisitorsRegistryClient } from './VisitorsRegistryClient';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const page = parseBoundedInt(params.page, 1, 1, 10_000);
  const pageSize = parseBoundedInt(params.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  const [{ deptId: contextDeptId }, canonicalAccessDeptId] = await Promise.all([
    getDepartmentContext({ department: 'access-control' }),
    getDeptId('access-control'),
  ]);
  const deptId = canonicalAccessDeptId ?? contextDeptId;

  const { visitors, totalCount } = await getVisitorsForDepartment(deptId, page, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <GlassCard variant="window" className="flex items-center justify-between p-5">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Visitor Management</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Approve pre-registrations, assign temporary credentials, and enforce 12-hour automatic
            exit.
          </p>
        </div>
      </GlassCard>

      <VisitorsRegistryClient
        visitors={visitors}
        initialAutoExited={[]}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        deptId={deptId}
      />
    </div>
  );
}
