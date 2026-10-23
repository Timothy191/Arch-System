'use client';

import { Badge } from '@repo/ui';
import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Edit2,
  FileBadge,
  Loader2,
  QrCode,
  Shield,
  Upload,
  User,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type DepartmentOption,
  type ProvisionedEmployeeResult,
  updateEmployeeAction,
} from '@/actions/employee-provisioning';

interface EditEmployeeModalProps {
  employee: ProvisionedEmployeeResult;
  departments: DepartmentOption[];
  onEmployeeUpdated?: (updated: ProvisionedEmployeeResult) => void;
}

export function EditEmployeeModal({
  employee,
  departments,
  onEmployeeUpdated,
}: EditEmployeeModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State initialized with employee data
  const [firstName, setFirstName] = useState(employee.first_name);
  const [surname, setSurname] = useState(employee.surname);
  const [idNumber, setIdNumber] = useState(employee.id_number);
  const [jobTitle, setJobTitle] = useState(employee.job_title || '');
  const [departmentId, setDepartmentId] = useState(
    employee.department_id || departments[0]?.id || ''
  );
  const [medicalExpiry, setMedicalExpiry] = useState(
    employee.medical_expiry ? employee.medical_expiry.split('T')[0] : ''
  );
  const [inductionExpiry, setInductionExpiry] = useState(
    employee.induction_expiry ? employee.induction_expiry.split('T')[0] : ''
  );
  const [qrCode, setQrCode] = useState(employee.badge?.qr_code || '');
  const [photoUrl, setPhotoUrl] = useState(employee.photo_url || '');
  const [status, setStatus] = useState(employee.status || 'Active');

  const selectedDepartment = departments.find((d) => d.id === departmentId);

  // Sync state if employee prop updates
  const handleOpen = () => {
    setFirstName(employee.first_name);
    setSurname(employee.surname);
    setIdNumber(employee.id_number);
    setJobTitle(employee.job_title || '');
    setDepartmentId(employee.department_id || departments[0]?.id || '');
    setMedicalExpiry(employee.medical_expiry ? employee.medical_expiry.split('T')[0] : '');
    setInductionExpiry(employee.induction_expiry ? employee.induction_expiry.split('T')[0] : '');
    setQrCode(employee.badge?.qr_code || '');
    setPhotoUrl(employee.photo_url || '');
    setStatus(employee.status || 'Active');
    setIsOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoUrl(reader.result as string);
      toast.success('New employee portrait loaded');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateQR = () => {
    const random = Math.floor(100000 + Math.random() * 900000);
    const prefix = firstName ? firstName.substring(0, 3).toUpperCase() : 'EMP';
    setQrCode(`QR-${prefix}-${random}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !surname.trim() || !idNumber.trim() || !jobTitle.trim()) {
      toast.error('Name, Surname, ID Number, and Job Title are required.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateEmployeeAction({
          id: employee.id,
          first_name: firstName,
          surname: surname,
          id_number: idNumber,
          job_title: jobTitle,
          department_id: departmentId || null,
          medical_expiry: medicalExpiry || null,
          induction_expiry: inductionExpiry || null,
          qr_code: qrCode || undefined,
          photo_url: photoUrl || null,
          status: status,
        });

        if (res.success && res.data) {
          toast.success(
            `Updated ${res.data.first_name} ${res.data.surname} (${res.data.job_title}). Changes synced to Supabase across all departments!`
          );
          onEmployeeUpdated?.(res.data);
          setIsOpen(false);
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to update employee details');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database update failed';
        toast.error(msg);
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="h-7 px-2 font-medium text-[var(--accent-blue)] text-xs transition-colors hover:bg-[var(--accent-blue)]/10"
      >
        <Edit2 className="mr-1 h-3.5 w-3.5" />
        Edit
      </Button>

      {isOpen && (
        <div className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm duration-200">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-window">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-10 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 md:p-8">
              {/* Header */}
              <div className="mb-6 flex items-center gap-3 border-[var(--border-subtle)] border-b pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-blue/20 bg-accent-blue/10 text-accent-blue">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--text-heading)] text-lg">
                    Edit Employee & Identity Credentials
                  </h2>
                  <p className="text-[var(--text-muted)] text-xs">
                    Updating details here propagates instantaneously to Supabase, Access Control
                    gates, Muster Stations, and Badge Printing.
                  </p>
                </div>
                <div className="ml-auto">
                  <span className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1 font-mono text-[var(--text-secondary)] text-xs">
                    {employee.emp_code}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Left Column: Personal & Job Details */}
                  <div className="space-y-4 lg:col-span-2">
                    {/* Row 1: First Name & Surname */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                          1. First Name <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                          2. Surname <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={surname}
                          onChange={(e) => setSurname(e.target.value)}
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                    </div>

                    {/* Row 2: ID Number & Job Title */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                          3. ID Number / Passport <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 font-mono text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                          4. Job Title <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder="e.g. ADT Operator, Rig Specialist"
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                    </div>

                    {/* Row 3: Area / Department & Status */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                          5. Assigned Area / Department
                        </label>
                        <select
                          value={departmentId}
                          onChange={(e) => setDepartmentId(e.target.value)}
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        >
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                          Operational Status
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        >
                          <option value="Active">Active</option>
                          <option value="On Leave">On Leave</option>
                          <option value="Suspended">Suspended (Access Blocked)</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 4: Compliance Expiries (Medical & Induction) */}
                    <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-3">
                        <label className="mb-1 block flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-xs">
                          <Calendar className="h-3.5 w-3.5 text-accent-blue" />
                          6. Medical Expiry
                        </label>
                        <input
                          type="date"
                          value={medicalExpiry}
                          onChange={(e) => setMedicalExpiry(e.target.value)}
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-3">
                        <label className="mb-1 block flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-xs">
                          <Clock className="h-3.5 w-3.5 text-accent-orange" />
                          7. Induction Expiry
                        </label>
                        <input
                          type="date"
                          value={inductionExpiry}
                          onChange={(e) => setInductionExpiry(e.target.value)}
                          className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                    </div>

                    {/* Row 5: QR Code Data */}
                    <div>
                      <label className="mb-1 block flex items-center justify-between font-semibold text-[var(--text-heading)] text-xs">
                        <span className="flex items-center gap-1.5">
                          <QrCode className="h-3.5 w-3.5 text-accent-green" />
                          8. QR Code / Badge Identifier
                        </span>
                        <button
                          type="button"
                          onClick={handleGenerateQR}
                          className="text-[11px] text-accent-blue hover:underline"
                        >
                          Regenerate Code
                        </button>
                      </label>
                      <input
                        type="text"
                        value={qrCode}
                        onChange={(e) => setQrCode(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 font-mono text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      />
                    </div>
                  </div>

                  {/* Right Column: Photo & Live Badge Card Preview */}
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block flex items-center gap-1.5 font-semibold text-[var(--text-heading)] text-xs">
                        <Camera className="h-3.5 w-3.5 text-accent-blue" />
                        9. Photo of Employee
                      </label>
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-[var(--border-default)] border-dashed p-3 transition-colors hover:border-accent-blue hover:bg-[var(--bg-secondary)]/50">
                        <Upload className="mb-1 h-5 w-5 text-[var(--text-muted)]" />
                        <span className="font-medium text-[11px] text-[var(--text-heading)]">
                          Change photo
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          PNG/JPG up to 2MB
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* ID-1 Physical Badge Preview */}
                    <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                      <div className="flex items-center justify-between border-[var(--border-subtle)] border-b pb-2">
                        <span className="font-bold text-[10px] text-accent-blue uppercase tracking-wider">
                          Identity Badge Preview
                        </span>
                        <Badge variant={status === 'Active' ? 'green' : 'red'} size="sm">
                          {status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)]">
                          {photoUrl ? (
                            <Image
                              src={photoUrl}
                              alt="Portrait"
                              fill
                              sizes="64px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <User className="h-6 w-6 text-[var(--text-muted)] opacity-50" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[var(--text-heading)] text-xs">
                            {firstName || 'First'} {surname || 'Surname'}
                          </p>
                          <p className="truncate font-medium text-[11px] text-accent-blue">
                            {jobTitle || 'Job Title'}
                          </p>
                          <p className="truncate text-[10px] text-[var(--text-muted)]">
                            {selectedDepartment?.display_name || 'Area'}
                          </p>
                          <p className="mt-1 truncate font-mono text-[9px] text-[var(--text-secondary)]">
                            {qrCode || 'No QR'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 border-[var(--border-subtle)] border-t pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    disabled={isPending}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="h-9 bg-accent-blue px-4 font-semibold text-bg-secondary text-xs shadow-diffusion-cyan hover:bg-accent-blue/90"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Synchronizing across Supabase...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Save Changes & Update System
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
