import { getDepartmentContext } from "~/lib/dept-context";
import { GlassCard } from "@repo/ui/GlassCard";
import { Button } from "@repo/ui/components/ui/button";
import { Pagination } from "@repo/ui/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { QrCode, Plus, UserCheck, ShieldOff } from "lucide-react";
import { getBadgesForDepartment } from "../actions";

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

export const dynamic = "force-dynamic";

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = parseInt(params.pageSize || "50", 10);

  const { deptId } = await getDepartmentContext({
    department: "access-control",
  });

  const { badges, totalCount } = await getBadgesForDepartment(deptId, page, pageSize);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Resolve entity names from nested relation data
  const resolvedBadges = (badges as unknown as BadgeWithRelations[]).map((b) => {
    let entityName = "Unknown";
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
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">Credential Management</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Issue, print, and revoke physical QR access credentials.
          </p>
        </div>
        <Button className="bg-accent-blue text-bg-secondary hover:bg-accent-blue/90 shadow-diffusion-cyan">
          <Plus className="w-4 h-4 mr-2" />
          Issue New Badge
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Active Badges Table (Takes up 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="p-0 overflow-hidden">
            <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50">
              <h3 className="font-semibold text-[var(--text-heading)] flex items-center">
                <UserCheck className="w-4 h-4 mr-2 text-accent-green" />
                Active Provisioned Badges
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-default)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)]">QR Code Data</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Assigned To</TableHead>
                  <TableHead className="text-[var(--text-muted)]">Entity Type</TableHead>
                  <TableHead className="text-right text-[var(--text-muted)]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedBadges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-[var(--text-muted)]">
                      No badges found for this department.
                    </TableCell>
                  </TableRow>
                )}
                {resolvedBadges.map((badge) => (
                  <TableRow
                    key={badge.id}
                    className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer group"
                  >
                    <TableCell className="font-mono text-sm text-[var(--accent-blue)] group-hover:text-accent-blue transition-colors">
                      {badge.qr_code}
                    </TableCell>
                    <TableCell className="font-medium text-[var(--text-heading)]">
                      {badge.entity_name}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)] capitalize">
                      {badge.entity_type}
                    </TableCell>
                    <TableCell className="text-right">
                      {badge.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50/70 border-emerald-200/50 text-emerald-700">
                          <span className="badge-pulse-dot bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-50/70 border-red-200/50 text-red-700">
                          Revoked
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="p-4 border-t border-[var(--border-default)]">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={(newPage) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("page", newPage.toString());
                    url.searchParams.set("pageSize", pageSize.toString());
                    window.location.href = url.toString();
                  }}
                  onPageSizeChange={(newSize) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("page", "1");
                    url.searchParams.set("pageSize", newSize.toString());
                    window.location.href = url.toString();
                  }}
                />
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Side: QR Generation/Preview Widget */}
        <div className="lg:col-span-1">
          <GlassCard className="relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-[var(--accent-blue)]/10 blur-3xl" />

            <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-blue)]/10 flex items-center justify-center border border-[var(--accent-blue)]/20 mb-2">
                <QrCode className="w-6 h-6 text-[var(--accent-blue)]" />
              </div>

              <h3 className="text-lg font-semibold text-[var(--text-heading)]">
                QR Preview Engine
              </h3>

              <p className="text-sm text-[var(--text-muted)]">
                Select a badge from the registry to securely display its scannable matrix code for
                physical printing or mobile sync.
              </p>

              {/* Placeholder for actual QR code rendering */}
              <div className="w-48 h-48 bg-[var(--bg-secondary)] rounded-xl p-2 flex items-center justify-center mt-4 shadow-card group-hover:shadow-[var(--accent-blue)]/10 transition-[box-shadow] duration-500">
                <div className="w-full h-full border-2 border-dashed border-[var(--border-subtle)] rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)]">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Select Badge</span>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-3 mt-6">
                <Button
                  variant="outline"
                  className="w-full text-xs font-medium border border-[var(--border-default)]"
                >
                  Print Batch
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-xs font-medium border-accent-red/20 text-accent-red hover:bg-accent-red/10 hover:text-accent-red"
                >
                  <ShieldOff className="w-3 h-3 mr-2" />
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
