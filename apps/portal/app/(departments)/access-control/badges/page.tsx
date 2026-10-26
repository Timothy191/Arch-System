import { Badge } from '@repo/ui';
import { Button } from '@repo/ui/components/ui/button';
import { Pagination } from '@repo/ui/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { GlassCard } from '@repo/ui/GlassCard';
import { Plus, QrCode, ShieldOff, UserCheck } from 'lucide-react';
import { getProvisioningReferenceData } from '@/actions/employee-provisioning';
import { EmployeeProvisioningModal } from '@/components/employee/EmployeeProvisioningModal';
import { getDepartmentContext } from '~/lib/dept-context';
import { getBadgesForDepartment } from '../actions';

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Active Badges Table (Takes up 2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          <GlassCard className="overflow-hidden p-0">
            <div className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
              <h3 className="flex items-center font-semibold text-[var(--text-heading)]">
                <UserCheck className="mr-2 h-4 w-4 text-accent-green" />
                Active Provisioned Badges
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)] border-b hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)]">QR Code Data</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Assigned To</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Entity Type</TableHead>
                  <TableHead className="text-right text-[var(--text-muted)]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedBadges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-[var(--text-muted)]">
                      No badges found for this department.
                    </TableCell>
                  </TableRow>
                )}
                {resolvedBadges.map((badge) => (
                  <TableRow
                    key={badge.id}
                    className="group cursor-pointer border-[var(--border-default)]/50 border-b transition-colors hover:bg-[var(--bg-tertiary)]"
                  >
                    <TableCell className="font-mono text-[var(--accent-blue)] text-sm transition-colors group-hover:text-accent-blue">
                      {badge.qr_code}
                    </TableCell>
                    <TableCell className="font-medium text-[var(--text-heading)]">
                      {badge.entity_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="blue" contrast="low" size="sm" className="capitalize">
                        {badge.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {badge.is_active ? (
                        <Badge variant="green" contrast="low" size="sm">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="red" contrast="low" size="sm">
                          Revoked
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="border-[var(--border-default)] border-t p-4">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Side: QR Generation/Preview Widget */}
        <div className="lg:col-span-1">
          <GlassCard className="group relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-[var(--accent-blue)]/10 blur-3xl" />

            <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10">
                <QrCode className="h-6 w-6 text-[var(--accent-blue)]" />
              </div>

              <h3 className="font-semibold text-[var(--text-heading)] text-lg">
                QR Preview Engine
              </h3>

              <p className="text-[var(--text-muted)] text-sm">
                Select a badge from the registry to securely display its scannable matrix code for
                physical printing or mobile sync.
              </p>

              {/* Placeholder for actual QR code rendering */}
              <div className="mt-4 flex h-48 w-48 items-center justify-center rounded-xl bg-[var(--bg-secondary)] p-2 shadow-card transition-[box-shadow] duration-500 group-hover:shadow-[var(--accent-blue)]/10">
                <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-[var(--border-subtle)] border-dashed bg-[var(--bg-tertiary)]">
                  <span className="font-medium text-[var(--text-muted)] text-xs">Select Badge</span>
                </div>
              </div>

              <div className="mt-6 grid w-full grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="w-full border border-[var(--border-default)] font-medium text-xs"
                >
                  Print Batch
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-accent-red/20 font-medium text-accent-red text-xs hover:bg-accent-red/10 hover:text-accent-red"
                >
                  <ShieldOff className="mr-2 h-3 w-3" />
                  Revoke All
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
