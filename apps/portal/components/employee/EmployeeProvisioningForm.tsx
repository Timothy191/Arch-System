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
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${className}`}>
      {/* ── Form Entry Panel (7 Cols) ── */}
      <div className="lg:col-span-7">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-heading)] flex items-center gap-2">
                <FileBadge className="w-5 h-5 text-[var(--accent-blue)]" />
                Employee Registration & Credential Setup
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                  Name (First Name) <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                  Surname <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dlamini"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>
            </div>

            {/* 2. ID No & Job Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                  ID Number (National ID / Passport) <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8904125289083"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                  Job Title <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Excavator Operator, Safety Officer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>
            </div>

            {/* 3. Area (Department) */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1">
                Area (Operational Department / Pit Section)
              </label>
              <div className="relative">
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center justify-between">
                  <span>Medical Expiry</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Occupational Health</span>
                </label>
                <input
                  type="date"
                  value={medicalExpiry}
                  onChange={(e) => setMedicalExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center justify-between">
                  <span>Induction Expiry</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Mine Safety Permit</span>
                </label>
                <input
                  type="date"
                  value={inductionExpiry}
                  onChange={(e) => setInductionExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
              </div>
            </div>

            {/* 5. QR Code String */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center justify-between">
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
                  className="flex-1 px-3 py-2 text-sm font-mono bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateQR}
                  className="shrink-0 text-xs gap-1.5 border-[var(--border-default)]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Generate
                </Button>
              </div>
            </div>

            {/* 6. Employee Photo */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-heading)] mb-1 flex items-center justify-between">
                <span>Photo of Employee</span>
                <span className="text-[10px] text-[var(--text-muted)]">JPG, PNG or Base64</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                  <span>Choose Photo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <div className="flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Or paste external image URL / Data URL..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-accent-blue text-bg-secondary hover:bg-accent-blue/90 shadow-diffusion-cyan px-5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registering Employee...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
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
        <GlassCard className="p-6 h-full flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 rounded-full bg-[var(--accent-blue)]/10 blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border-subtle)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Live Credential Preview
              </span>
              <Badge variant="green" size="sm">
                ISO/IEC 7810 ID-1
              </Badge>
            </div>

            {/* Virtual Access Badge Card */}
            <div className="bg-[var(--bg-secondary)] border-2 border-[var(--border-default)] rounded-xl p-4 shadow-window text-[var(--text-heading)] relative overflow-hidden">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-accent-blue">
                    Arch Mining Security
                  </span>
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    {selectedDepartment?.display_name || 'General Operations'}
                  </p>
                </div>
                <QrCode className="w-5 h-5 text-[var(--accent-blue)]" />
              </div>

              {/* Body: Photo + Personal Details */}
              <div className="flex gap-4 items-start">
                {/* Employee Photo Thumbnail */}
                <div className="w-24 h-28 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden shrink-0 relative">
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
                      <Camera className="w-6 h-6 mb-1 opacity-50" />
                      <span className="text-[9px] uppercase tracking-wider">No Photo</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-sm font-bold truncate">
                    {firstName || surname ? `${firstName} ${surname}`.trim() : 'Employee Name'}
                  </h4>
                  <p className="text-xs text-[var(--accent-blue)] font-medium truncate">
                    {jobTitle || 'Designated Role'}
                  </p>
                  <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                    ID: {idNumber || '0000000000000'}
                  </p>

                  <div className="pt-2 text-[10px] space-y-0.5 text-[var(--text-muted)] border-t border-[var(--border-subtle)] mt-2">
                    <p className="flex justify-between">
                      <span>Medical:</span>
                      <span
                        className={
                          medicalExpiry && new Date(medicalExpiry) < new Date()
                            ? 'text-accent-red font-semibold'
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
                            ? 'text-accent-red font-semibold'
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
              <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                <span className="truncate max-w-[200px]">
                  {qrCode || 'QR-EMP-PENDING-REGISTRATION'}
                </span>
                <span className="text-accent-green font-semibold uppercase">ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--accent-blue)] mt-0.5" />
            <p>
              Provisioning instantly propagates this record to PostgreSQL tables{' '}
              <code className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded font-mono">
                personnel
              </code>{' '}
              and{' '}
              <code className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded font-mono">badges</code>
              , synchronizing with the Chainway C66 RFID barrier readers.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
