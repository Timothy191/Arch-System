import { Badge } from '@repo/ui';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  Calendar,
  Camera,
  CheckCircle2,
  Database,
  FileBadge,
  HardDrive,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { connection } from 'next/server';
import { getProvisioningReferenceData } from '@/actions/employee-provisioning';
import { EditEmployeeModal } from '@/components/employee/EditEmployeeModal';
import { EmployeeProvisioningForm } from '@/components/employee/EmployeeProvisioningForm';

export default async function DatabasePanelsPage() {
  await connection();

  const { departments, recentPersonnel } = await getProvisioningReferenceData();

  // Compute live compliance statistics from PostgreSQL records
  const totalEmployees = recentPersonnel.length;
  const now = new Date();

  const medicalValidCount = recentPersonnel.filter((p) => {
    if (!p.medical_expiry) return false;
    return new Date(p.medical_expiry) > now;
  }).length;

  const inductionValidCount = recentPersonnel.filter((p) => {
    if (!p.induction_expiry) return false;
    return new Date(p.induction_expiry) > now;
  }).length;

  const activeBadgesCount = recentPersonnel.filter((p) => p.badge?.is_active).length;

  const medicalCompliancePct =
    totalEmployees > 0 ? Math.round((medicalValidCount / totalEmployees) * 100) : 100;
  const inductionCompliancePct =
    totalEmployees > 0 ? Math.round((inductionValidCount / totalEmployees) * 100) : 100;

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-2xl text-[var(--text-heading)]">
            <Database className="h-6 w-6 text-accent-green" />
            Database Control & Personnel Provisioning Panels
          </h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Direct database console for personnel records, safety compliance, and physical QR badge
            credentials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="green" size="sm">
            Live Synchronized
          </Badge>
          <Badge variant="blue" size="sm">
            PostgreSQL 17
          </Badge>
        </div>
      </div>

      {/* ── Key Metrics Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Total Personnel
            </span>
            <Users className="h-4 w-4 text-[var(--accent-blue)]" />
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">{totalEmployees}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Active personnel table records
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Active QR Badges
            </span>
            <QrCode className="h-4 w-4 text-accent-green" />
          </div>
          <p className="mt-2 font-bold text-2xl text-accent-green">{activeBadgesCount}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">Bound to C66 scan gate matrix</p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Medical Compliance
            </span>
            <ShieldCheck className="h-4 w-4 text-[var(--accent-blue)]" />
          </div>
          <p className="mt-2 font-bold text-2xl text-[var(--text-heading)]">
            {medicalCompliancePct}%
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {medicalValidCount} of {totalEmployees} current
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Induction Safety
            </span>
            <UserCheck className="h-4 w-4 text-violet-500" />
          </div>
          <p className="mt-2 font-bold text-2xl text-violet-500">{inductionCompliancePct}%</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {inductionValidCount} of {totalEmployees} certified
          </p>
        </GlassCard>
      </div>

      <Divider variant="fading" label="NEW EMPLOYEE DATABASE PROVISIONING" />

      {/* ── Direct Employee Provisioning Studio ── */}
      <EmployeeProvisioningForm departments={departments} sourceContext="database-panels" />

      <Divider variant="fading" label="LIVE DATABASE PERSONNEL & CREDENTIAL REGISTRY" />

      {/* ── Table of Existing Personnel with All 9 Fields ── */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
            <HardDrive className="h-4 w-4 text-accent-green" />
            PostgreSQL Registry Table: <code className="font-mono text-xs">public.personnel</code> &{' '}
            <code className="font-mono text-xs">public.badges</code>
          </h3>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            {recentPersonnel.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/30 font-medium text-[var(--text-muted)]">
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3">Name & Surname</th>
                <th className="px-4 py-3">ID Number</th>
                <th className="px-4 py-3">Job Title</th>
                <th className="px-4 py-3">Area / Dept</th>
                <th className="px-4 py-3">Medical Expiry</th>
                <th className="px-4 py-3">Induction Expiry</th>
                <th className="px-4 py-3">QR Code Data</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {recentPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[var(--text-muted)]">
                    No personnel records found. Use the provisioning form above to create your first
                    employee.
                  </td>
                </tr>
              ) : (
                recentPersonnel.map((p) => {
                  const isMedicalValid = p.medical_expiry
                    ? new Date(p.medical_expiry) > now
                    : false;
                  const isInductionValid = p.induction_expiry
                    ? new Date(p.induction_expiry) > now
                    : false;

                  return (
                    <tr
                      key={p.id}
                      className="text-[var(--text-heading)] transition-colors hover:bg-[var(--bg-tertiary)]/50"
                    >
                      {/* 1. Photo */}
                      <td className="px-4 py-2">
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)]">
                          {p.photo_url ? (
                            <Image
                              src={p.photo_url}
                              alt={`${p.first_name} ${p.surname}`}
                              fill
                              sizes="36px"
                              className="object-cover object-center"
                              unoptimized
                            />
                          ) : (
                            <Camera className="h-4 w-4 text-[var(--text-muted)] opacity-60" />
                          )}
                        </div>
                      </td>

                      {/* 2. Name & Surname */}
                      <td className="whitespace-nowrap px-4 py-2 font-semibold">
                        {p.first_name} {p.surname}
                        <span className="block font-mono font-normal text-[10px] text-[var(--text-muted)]">
                          {p.emp_code}
                        </span>
                      </td>

                      {/* 3. ID No */}
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-[var(--text-secondary)]">
                        {p.id_number}
                      </td>

                      {/* 4. Job Title */}
                      <td className="whitespace-nowrap px-4 py-2">{p.job_title || 'Operator'}</td>

                      {/* 5. Area */}
                      <td className="whitespace-nowrap px-4 py-2">
                        <Badge variant="blue" size="sm">
                          {p.area_name || 'General Mining'}
                        </Badge>
                      </td>

                      {/* 6. Medical Expiry */}
                      <td className="whitespace-nowrap px-4 py-2">
                        {p.medical_expiry ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                              isMedicalValid ? 'text-accent-green' : 'font-bold text-accent-red'
                            }`}
                          >
                            {new Date(p.medical_expiry).toLocaleDateString('en-ZA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">Not set</span>
                        )}
                      </td>

                      {/* 7. Induction Expiry */}
                      <td className="whitespace-nowrap px-4 py-2">
                        {p.induction_expiry ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                              isInductionValid ? 'text-accent-green' : 'font-bold text-accent-red'
                            }`}
                          >
                            {new Date(p.induction_expiry).toLocaleDateString('en-ZA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">Not set</span>
                        )}
                      </td>

                      {/* 8. QR Code */}
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-[var(--accent-blue)]">
                        {p.badge?.qr_code || 'Unassigned'}
                      </td>

                      {/* 9. Status */}
                      <td className="whitespace-nowrap px-4 py-2 text-center">
                        <Badge variant={p.status === 'Active' ? 'green' : 'red'} size="sm">
                          {p.status || 'Active'}
                        </Badge>
                      </td>

                      {/* 10. Actions */}
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <EditEmployeeModal employee={p} departments={departments} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
