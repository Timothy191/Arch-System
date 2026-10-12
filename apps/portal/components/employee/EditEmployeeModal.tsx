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
        className="h-7 px-2 text-xs text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 font-medium transition-colors"
      >
        <Edit2 className="w-3.5 h-3.5 mr-1" />
        Edit
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-window bg-[var(--bg-primary)] border border-[var(--border-default)]">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors border border-[var(--border-default)]"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 md:p-8">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[var(--border-subtle)]">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-heading)]">
                    Edit Employee & Identity Credentials
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Updating details here propagates instantaneously to Supabase, Access Control
                    gates, Muster Stations, and Badge Printing.
                  </p>
                </div>
                <div className="ml-auto">
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                    {employee.emp_code}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Personal & Job Details */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Row 1: First Name & Surname */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                          1. First Name <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                          2. Surname <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={surname}
                          onChange={(e) => setSurname(e.target.value)}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                    </div>

                    {/* Row 2: ID Number & Job Title */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                          3. ID Number / Passport <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                          4. Job Title <span className="text-accent-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder="e.g. ADT Operator, Rig Specialist"
                          className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                    </div>

                    {/* Row 3: Area / Department & Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                          5. Assigned Area / Department
                        </label>
                        <select
                          value={departmentId}
                          onChange={(e) => setDepartmentId(e.target.value)}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        >
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                          Operational Status
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        >
                          <option value="Active">Active</option>
                          <option value="On Leave">On Leave</option>
                          <option value="Suspended">Suspended (Access Blocked)</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 4: Compliance Expiries (Medical & Induction) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50">
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-accent-blue" />
                          6. Medical Expiry
                        </label>
                        <input
                          type="date"
                          value={medicalExpiry}
                          onChange={(e) => setMedicalExpiry(e.target.value)}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                      <div className="p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50">
                        <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-accent-orange" />
                          7. Induction Expiry
                        </label>
                        <input
                          type="date"
                          value={inductionExpiry}
                          onChange={(e) => setInductionExpiry(e.target.value)}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        />
                      </div>
                    </div>

                    {/* Row 5: QR Code Data */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-accent-green" />
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
                        className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      />
                    </div>
                  </div>

                  {/* Right Column: Photo & Live Badge Card Preview */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-accent-blue" />
                        9. Photo of Employee
                      </label>
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-[var(--border-default)] rounded-xl cursor-pointer hover:border-accent-blue hover:bg-[var(--bg-secondary)]/50 transition-colors">
                        <Upload className="w-5 h-5 text-[var(--text-muted)] mb-1" />
                        <span className="text-[11px] font-medium text-[var(--text-heading)]">
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
                    <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] space-y-3">
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-blue">
                          Identity Badge Preview
                        </span>
                        <Badge variant={status === 'Active' ? 'green' : 'red'} size="sm">
                          {status}
                        </Badge>
                      </div>

                      <div className="flex gap-3 items-center">
                        <div className="w-16 h-20 rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] overflow-hidden shrink-0 relative flex items-center justify-center">
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
                            <User className="w-6 h-6 text-[var(--text-muted)] opacity-50" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-[var(--text-heading)] truncate">
                            {firstName || 'First'} {surname || 'Surname'}
                          </p>
                          <p className="text-[11px] text-accent-blue font-medium truncate">
                            {jobTitle || 'Job Title'}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {selectedDepartment?.display_name || 'Area'}
                          </p>
                          <p className="font-mono text-[9px] text-[var(--text-secondary)] mt-1 truncate">
                            {qrCode || 'No QR'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
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
                    className="bg-accent-blue text-bg-secondary hover:bg-accent-blue/90 text-xs font-semibold px-4 h-9 shadow-diffusion-cyan"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Synchronizing across Supabase...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
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
