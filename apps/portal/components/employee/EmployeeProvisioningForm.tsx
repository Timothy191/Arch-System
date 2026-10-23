'use client';

import { Badge } from '@repo/ui';
import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertCircle,
  Building,
  Calendar,
  Camera,
  CheckCircle2,
  FileBadge,
  Loader2,
  QrCode,
  RefreshCw,
  Upload,
  User,
} from 'lucide-react';
import Image from 'next/image';
import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type DepartmentOption,
  type ProvisionedEmployeeResult,
  provisionNewEmployee,
} from '@/actions/employee-provisioning';

interface EmployeeProvisioningFormProps {
  departments: DepartmentOption[];
  onSuccess?: (created: ProvisionedEmployeeResult) => void;
  className?: string;
  sourceContext?: 'access-control' | 'database-panels';
}

export function EmployeeProvisioningForm({
  departments,
  onSuccess,
  className = '',
  sourceContext = 'access-control',
}: EmployeeProvisioningFormProps) {
  const [isPending, startTransition] = useTransition();

  // 9 Required Fields State
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [medicalExpiry, setMedicalExpiry] = useState('');
  const [inductionExpiry, setInductionExpiry] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Auto-generate QR code helper
  const handleGenerateQR = () => {
    const random = Math.floor(100000 + Math.random() * 900000);
    const prefix = firstName ? `${firstName.substring(0, 3).toUpperCase()}` : 'EMP';
    setQrCode(`QR-${prefix}-${random}`);
  };

  // Photo file upload helper (reads as base64 Data URL)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image exceeds 2MB limit. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
        toast.success('Photo loaded successfully');
      }
    };
    reader.readAsDataURL(file);
  };

  const selectedDepartment = departments.find((d) => d.id === departmentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !surname.trim()) {
      toast.error('First Name and Surname are required.');
      return;
    }

    if (!idNumber.trim()) {
      toast.error('National ID / Passport Number is required.');
      return;
    }

    if (!jobTitle.trim()) {
      toast.error('Job Title is required.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await provisionNewEmployee({
          first_name: firstName,
          surname,
          id_number: idNumber,
          job_title: jobTitle,
          department_id: departmentId || undefined,
          area: selectedDepartment?.display_name,
          medical_expiry: medicalExpiry || null,
          induction_expiry: inductionExpiry || null,
          qr_code: qrCode || undefined,
          photo_url: photoUrl || null,
        });

        if (res.success) {
          toast.success(
            `Employee ${res.data.first_name} ${res.data.surname} successfully provisioned!`
          );

          // Reset Form
          setFirstName('');
          setSurname('');
          setIdNumber('');
          setJobTitle('');
          setMedicalExpiry('');
          setInductionExpiry('');
          setQrCode('');
          setPhotoUrl('');

          onSuccess?.(res.data);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to provision employee');
      }
    });
  };

  return (
    <div className={`grid grid-cols-1 gap-6 lg:grid-cols-12 ${className}`}>
      {/* ── Form Entry Panel (7 Cols) ── */}
      <div className="lg:col-span-7">
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center justify-between border-[var(--border-subtle)] border-b pb-4">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-lg">
                <FileBadge className="h-5 w-5 text-[var(--accent-blue)]" />
                Employee Registration & Credential Setup
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                {sourceContext === 'database-panels'
                  ? 'Database Direct Sync: Provisions personnel entity and linked physical QR badge.'
                  : 'Access Control Provisioning: Full credential badging with safety expiry tracking.'}
              </p>
            </div>
            <Badge variant="blue" size="sm">
              9-Point Setup
            </Badge>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Name & Surname */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                  Name (First Name) <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                  Surname <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dlamini"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>
            </div>

            {/* 2. ID No & Job Title */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                  ID Number (National ID / Passport) <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8904125289083"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                  Job Title <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Excavator Operator, Safety Officer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>
            </div>

            {/* 3. Area (Department) */}
            <div>
              <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
                Area (Operational Department / Pit Section)
              </label>
              <div className="relative">
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.display_name} ({dept.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Medical Expiry & Induction Expiry */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block flex items-center justify-between font-semibold text-[var(--text-heading)] text-xs">
                  <span>Medical Expiry</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Occupational Health</span>
                </label>
                <input
                  type="date"
                  value={medicalExpiry}
                  onChange={(e) => setMedicalExpiry(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="mb-1 block flex items-center justify-between font-semibold text-[var(--text-heading)] text-xs">
                  <span>Induction Expiry</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Mine Safety Permit</span>
                </label>
                <input
                  type="date"
                  value={inductionExpiry}
                  onChange={(e) => setInductionExpiry(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>
            </div>

            {/* 5. QR Code String */}
            <div>
              <label className="mb-1 block flex items-center justify-between font-semibold text-[var(--text-heading)] text-xs">
                <span>QR Code Data Matrix</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Physical Badge Scannable Key
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Auto-generated if left blank"
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateQR}
                  className="shrink-0 gap-1.5 border-[var(--border-default)] text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate
                </Button>
              </div>
            </div>

            {/* 6. Employee Photo */}
            <div>
              <label className="mb-1 block flex items-center justify-between font-semibold text-[var(--text-heading)] text-xs">
                <span>Photo of Employee</span>
                <span className="text-[10px] text-[var(--text-muted)]">JPG, PNG or Base64</span>
              </label>

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]">
                  <Upload className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                  <span>Choose Photo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <div className="w-full flex-1">
                  <input
                    type="text"
                    placeholder="Or paste external image URL / Data URL..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 border-[var(--border-subtle)] border-t pt-3">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-accent-blue px-5 text-bg-secondary shadow-diffusion-cyan hover:bg-accent-blue/90"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering Employee...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Register Employee & Provision Badge
                  </>
                )}
              </Button>
            </div>
          </form>
        </GlassCard>
      </div>

      {/* ── Real-Time Badge Visualizer (5 Cols) ── */}
      <div className="lg:col-span-5">
        <GlassCard className="relative flex h-full flex-col justify-between overflow-hidden p-6">
          <div className="pointer-events-none absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-[var(--accent-blue)]/10 blur-3xl" />

          <div>
            <div className="mb-4 flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
              <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                Live Credential Preview
              </span>
              <Badge variant="green" size="sm">
                ISO/IEC 7810 ID-1
              </Badge>
            </div>

            {/* Virtual Access Badge Card */}
            <div className="relative overflow-hidden rounded-xl border-2 border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-[var(--text-heading)] shadow-window">
              {/* Header Bar */}
              <div className="mb-3 flex items-center justify-between border-[var(--border-subtle)] border-b pb-2">
                <div>
                  <span className="font-bold text-[10px] text-accent-blue uppercase tracking-widest">
                    Arch Mining Security
                  </span>
                  <p className="font-medium text-[var(--text-muted)] text-xs">
                    {selectedDepartment?.display_name || 'General Operations'}
                  </p>
                </div>
                <QrCode className="h-5 w-5 text-[var(--accent-blue)]" />
              </div>

              {/* Body: Photo + Personal Details */}
              <div className="flex items-start gap-4">
                {/* Employee Photo Thumbnail */}
                <div className="relative flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt="Employee Avatar"
                      fill
                      sizes="96px"
                      className="object-cover object-center"
                      unoptimized
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                      <Camera className="mb-1 h-6 w-6 opacity-50" />
                      <span className="text-[9px] uppercase tracking-wider">No Photo</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="truncate font-bold text-sm">
                    {firstName || surname ? `${firstName} ${surname}`.trim() : 'Employee Name'}
                  </h4>
                  <p className="truncate font-medium text-[var(--accent-blue)] text-xs">
                    {jobTitle || 'Designated Role'}
                  </p>
                  <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                    ID: {idNumber || '0000000000000'}
                  </p>

                  <div className="mt-2 space-y-0.5 border-[var(--border-subtle)] border-t pt-2 text-[10px] text-[var(--text-muted)]">
                    <p className="flex justify-between">
                      <span>Medical:</span>
                      <span
                        className={
                          medicalExpiry && new Date(medicalExpiry) < new Date()
                            ? 'font-semibold text-accent-red'
                            : 'font-mono'
                        }
                      >
                        {medicalExpiry || 'Not set'}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span>Induction:</span>
                      <span
                        className={
                          inductionExpiry && new Date(inductionExpiry) < new Date()
                            ? 'font-semibold text-accent-red'
                            : 'font-mono'
                        }
                      >
                        {inductionExpiry || 'Not set'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom: QR Code String */}
              <div className="mt-3 flex items-center justify-between border-[var(--border-subtle)] border-t pt-2 font-mono text-[10px] text-[var(--text-muted)]">
                <span className="max-w-[200px] truncate">
                  {qrCode || 'QR-EMP-PENDING-REGISTRATION'}
                </span>
                <span className="font-semibold text-accent-green uppercase">ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 border-[var(--border-subtle)] border-t pt-4 text-[11px] text-[var(--text-muted)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-blue)]" />
            <p>
              Provisioning instantly propagates this record to PostgreSQL tables{' '}
              <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 font-mono">
                personnel
              </code>{' '}
              and{' '}
              <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 font-mono">badges</code>
              , synchronizing with the Chainway C66 RFID barrier readers.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
