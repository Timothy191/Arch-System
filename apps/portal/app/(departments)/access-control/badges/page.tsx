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

export default async function BadgesPage({
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

  const [{ badges, totalCount }, { departments }] = await Promise.all([
    getBadgesForDepartment(deptId, page, pageSize),
    getProvisioningReferenceData(),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve entity names from nested relation data
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
      {/* Header */}
      <div className="flex items-center justify-between">
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
      </div>

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
