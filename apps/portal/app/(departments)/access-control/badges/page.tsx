import { GlassCard } from '@repo/ui/GlassCard';
import { connection } from 'next/server';
import { getProvisioningReferenceData } from '@/actions/employee-provisioning';
import { EmployeeProvisioningModal } from '@/components/employee/EmployeeProvisioningModal';
import { getDepartmentContext } from '~/lib/dept-context';
import { getBadgesForDepartment } from '../actions';
import { BadgesRegistryClient } from './BadgesRegistryClient';

interface BadgeWithRelations {
  id: string;
  qr_code: string;
  entity_type: string;
  is_active: boolean | null;
  issued_at: string | null;
  expires_at: string | null;
  personnel: { first_name: string; surname: string } | null;
  visitor: { first_name: string; surname: string } | null;
  fleet: { fleet_code: string; vehicle_type: string } | null;
  equipment: { equip_code: string; equipment_type: string } | null;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; entity?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const page = parseBoundedInt(params.page, 1, 1, 10_000);
  const pageSize = parseBoundedInt(params.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  const { deptId } = await getDepartmentContext({
    department: 'access-control',
  });

  const [{ badges, totalCount }, { departments }] = await Promise.all([
    getBadgesForDepartment(deptId, page, pageSize),
    getProvisioningReferenceData(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const resolvedBadges = (badges as unknown as BadgeWithRelations[]).map((b) => {
    let entityName = 'Unknown';
    if (b.personnel) {
      entityName = `${b.personnel.first_name} ${b.personnel.surname}`;
    } else if (b.visitor) {
      entityName = `${b.visitor.first_name} ${b.visitor.surname}`;
    } else if (b.fleet) {
      entityName = `${b.fleet.fleet_code} (${b.fleet.vehicle_type})`;
    } else if (b.equipment) {
      entityName = `${b.equipment.equip_code} (${b.equipment.equipment_type})`;
    }
    return { ...b, entity_name: entityName };
  });

  return (
    <div className="space-y-6">
      <GlassCard variant="window" className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Credential Management</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Issue, print, and revoke physical QR access credentials.
          </p>
        </div>
        <EmployeeProvisioningModal
          departments={departments}
          triggerLabel="Add Employee & Issue Badge"
        />
      </GlassCard>

      <BadgesRegistryClient
        badges={resolvedBadges}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
      />
    </div>
  );
}
