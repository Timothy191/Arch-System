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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] flex items-center gap-2">
            <Database className="w-6 h-6 text-accent-green" />
            Database Control & Personnel Provisioning Panels
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Total Personnel
            </span>
            <Users className="w-4 h-4 text-[var(--accent-blue)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">{totalEmployees}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Active personnel table records
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Active QR Badges
            </span>
            <QrCode className="w-4 h-4 text-accent-green" />
          </div>
          <p className="text-2xl font-bold text-accent-green mt-2">{activeBadgesCount}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Bound to C66 scan gate matrix</p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Medical Compliance
            </span>
            <ShieldCheck className="w-4 h-4 text-[var(--accent-blue)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">
            {medicalCompliancePct}%
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {medicalValidCount} of {totalEmployees} current
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Induction Safety
            </span>
            <UserCheck className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-2xl font-bold text-violet-500 mt-2">{inductionCompliancePct}%</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {inductionValidCount} of {totalEmployees} certified
          </p>
        </GlassCard>
      </div>

      <Divider variant="fading" label="NEW EMPLOYEE DATABASE PROVISIONING" />

      {/* ── Direct Employee Provisioning Studio ── */}
      <EmployeeProvisioningForm departments={departments} sourceContext="database-panels" />

      <Divider variant="fading" label="LIVE DATABASE PERSONNEL & CREDENTIAL REGISTRY" />

      {/* ── Table of Existing Personnel with All 9 Fields ── */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[var(--text-heading)] flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-accent-green" />
            PostgreSQL Registry Table: <code className="text-xs font-mono">public.personnel</code> &{' '}
            <code className="text-xs font-mono">public.badges</code>
          </h3>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {recentPersonnel.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/30 text-[var(--text-muted)] font-medium">
                <th className="py-3 px-4">Photo</th>
                <th className="py-3 px-4">Name & Surname</th>
                <th className="py-3 px-4">ID Number</th>
                <th className="py-3 px-4">Job Title</th>
                <th className="py-3 px-4">Area / Dept</th>
                <th className="py-3 px-4">Medical Expiry</th>
                <th className="py-3 px-4">Induction Expiry</th>
                <th className="py-3 px-4">QR Code Data</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
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
                      className="hover:bg-[var(--bg-tertiary)]/50 transition-colors text-[var(--text-heading)]"
                    >
                      {/* 1. Photo */}
                      <td className="py-2 px-4">
                        <div className="w-9 h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden flex items-center justify-center relative shrink-0">
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
                            <Camera className="w-4 h-4 text-[var(--text-muted)] opacity-60" />
                          )}
                        </div>
                      </td>

                      {/* 2. Name & Surname */}
                      <td className="py-2 px-4 font-semibold whitespace-nowrap">
                        {p.first_name} {p.surname}
                        <span className="block text-[10px] font-mono text-[var(--text-muted)] font-normal">
                          {p.emp_code}
                        </span>
                      </td>

                      {/* 3. ID No */}
                      <td className="py-2 px-4 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                        {p.id_number}
                      </td>

                      {/* 4. Job Title */}
                      <td className="py-2 px-4 whitespace-nowrap">{p.job_title || 'Operator'}</td>

                      {/* 5. Area */}
                      <td className="py-2 px-4 whitespace-nowrap">
                        <Badge variant="blue" size="sm">
                          {p.area_name || 'General Mining'}
                        </Badge>
                      </td>

                      {/* 6. Medical Expiry */}
                      <td className="py-2 px-4 whitespace-nowrap">
                        {p.medical_expiry ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                              isMedicalValid ? 'text-accent-green' : 'text-accent-red font-bold'
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
                      <td className="py-2 px-4 whitespace-nowrap">
                        {p.induction_expiry ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                              isInductionValid ? 'text-accent-green' : 'text-accent-red font-bold'
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
                      <td className="py-2 px-4 font-mono text-[11px] text-[var(--accent-blue)] whitespace-nowrap">
                        {p.badge?.qr_code || 'Unassigned'}
                      </td>

                      {/* 9. Status */}
                      <td className="py-2 px-4 text-center whitespace-nowrap">
                        <Badge variant={p.status === 'Active' ? 'green' : 'red'} size="sm">
                          {p.status || 'Active'}
                        </Badge>
                      </td>

                      {/* 10. Actions */}
                      <td className="py-2 px-4 text-right whitespace-nowrap">
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
