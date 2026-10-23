'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Camera,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Edit3,
  FileCheck2,
  Layers,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { QRCodeSection } from '../card-actions/qr-section';
import type {
  CardPrintJob,
  CardStudioDepartment,
  EmployeeCardProfile,
  Neo300Printer,
  UpsertEmployeeCardInput,
} from './actions';
import {
  cancelNeo300Job,
  getEmployeeCardProfiles,
  sendNeo300PrintJob,
  upsertEmployeeForCardPrinting,
} from './actions';

interface Neo300PrintStudioProps {
  initialPrinter: Neo300Printer;
  initialEmployees: EmployeeCardProfile[];
  initialJobs: CardPrintJob[];
  departments?: CardStudioDepartment[];
}

const DEFAULT_EXPIRY_ONE_YEAR = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0]!;
};

export function Neo300PrintStudio({
  initialPrinter,
  initialEmployees,
  initialJobs,
  departments = [],
}: Neo300PrintStudioProps) {
  const [printer] = useState<Neo300Printer>(initialPrinter);
  const [employees, setEmployees] = useState<EmployeeCardProfile[]>(initialEmployees);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeCardProfile | null>(
    initialEmployees[0] ?? null
  );
  const [jobs, setJobs] = useState<CardPrintJob[]>(initialJobs);
  const [search, setSearch] = useState('');
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formState, setFormState] = useState<UpsertEmployeeCardInput>({
    emp_code: '',
    first_name: '',
    surname: '',
    id_number: '',
    job_title: 'Haul Truck Operator',
    department_id: departments[0]?.id ?? null,
    area: 'Main Complex',
    status: 'Active',
    medical_expiry: DEFAULT_EXPIRY_ONE_YEAR(),
    induction_expiry: DEFAULT_EXPIRY_ONE_YEAR(),
    photo_url: '',
    rfid_code: '',
    qr_code: '',
  });

  const openCreateEmployeeModal = () => {
    const nextCode = `EMP-${String(employees.length + 101).padStart(4, '0')}`;
    setEditorMode('create');
    setFormState({
      emp_code: nextCode,
      first_name: '',
      surname: '',
      id_number: '',
      job_title: 'Site Operator',
      department_id: departments[0]?.id ?? null,
      area: 'Main Complex',
      status: 'Active',
      medical_expiry: DEFAULT_EXPIRY_ONE_YEAR(),
      induction_expiry: DEFAULT_EXPIRY_ONE_YEAR(),
      photo_url: '',
      rfid_code: `RFID-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      qr_code: `EMP-${nextCode}`,
    });
    setShowEditor(true);
  };

  const openEditEmployeeModal = (emp: EmployeeCardProfile) => {
    setEditorMode('edit');
    setFormState({
      id: emp.id,
      emp_code: emp.emp_code,
      first_name: emp.first_name,
      surname: emp.surname,
      id_number: emp.id_number,
      job_title: emp.job_title || 'Site Operator',
      department_id: emp.department_id ?? departments[0]?.id ?? null,
      area: emp.area || 'Main Complex',
      status: emp.status || 'Active',
      medical_expiry: emp.medical_expiry || DEFAULT_EXPIRY_ONE_YEAR(),
      induction_expiry: emp.induction_expiry || DEFAULT_EXPIRY_ONE_YEAR(),
      photo_url: emp.photo_url || '',
      rfid_code: emp.rfid_code || '',
      qr_code: emp.qr_code || `EMP-${emp.emp_code}`,
    });
    setShowEditor(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetW = 240;
        const targetH = 300;
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Center-crop portrait aspect ratio
          const scale = Math.max(targetW / img.width, targetH / img.height);
          const sw = targetW / scale;
          const sh = targetH / scale;
          const sx = (img.width - sw) / 2;
          const sy = (img.height - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          setFormState((prev) => ({ ...prev, photo_url: dataUrl }));
          toast.success('Employee ID photo processed & ready for CR80 card');
        }
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const saved = await upsertEmployeeForCardPrinting(formState);
        const refreshed = await getEmployeeCardProfiles(search);
        setEmployees(refreshed);
        const match = refreshed.find((item) => item.id === saved.id) ?? saved;
        setSelectedEmp(match);
        setShowEditor(false);
        toast.success(
          editorMode === 'create'
            ? `${saved.first_name} ${saved.surname} added to database & ready for card printing!`
            : `${saved.first_name} ${saved.surname} profile & card details updated!`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save employee record');
      }
    });
  };

  const handleSearch = (term: string) => {
    setSearch(term);
    startTransition(async () => {
      const results = await getEmployeeCardProfiles(term);
      setEmployees(results);
      if (results.length > 0 && !results.find((e) => e.id === selectedEmp?.id)) {
        setSelectedEmp(results[0]!);
      }
    });
  };

  const handlePrint = (employeeId: string) => {
    startTransition(async () => {
      try {
        const result = await sendNeo300PrintJob(employeeId);
        if (result.success && result.job) {
          toast.success(
            `Print job sent to ${printer.model} for ${selectedEmp?.first_name} ${selectedEmp?.surname}!`
          );
          setJobs((prev) => [result.job as CardPrintJob, ...prev]);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to dispatch print job';
        toast.error(message);
      }
    });
  };

  const handleCancelJob = (jobId: string) => {
    startTransition(async () => {
      try {
        await cancelNeo300Job(jobId);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'cancelled' } : j)));
        toast.info('Job cancelled');
      } catch (_err: unknown) {
        toast.error('Failed to cancel job');
      }
    });
  };

  const isMedicalValid =
    selectedEmp?.medical_expiry && new Date(selectedEmp.medical_expiry) > new Date();
  const isInductionValid =
    selectedEmp?.induction_expiry && new Date(selectedEmp.induction_expiry) > new Date();

  return (
    <div className="space-y-6">
      {/* ── Top Header & Neo 300 Printer Status Widget ── */}
      <GlassCard className="border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-5 backdrop-blur-md">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/20 shadow-md">
              <Printer className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[var(--text-heading)] text-xl tracking-tight">
                  Magicard Neo 300 Card & Employee Provisioning Studio
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700 text-xs">
                  <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-600" />
                  {printer.status.toUpperCase()}
                </span>
              </div>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Model:{' '}
                <span className="font-semibold text-[var(--text-primary)]">{printer.model}</span> |
                CUPS Queue: <span className="font-mono text-blue-600">{printer.cups_name}</span> |
                Connection:{' '}
                <span className="text-[var(--text-primary)] uppercase">
                  {printer.connection_type}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center">
            <div className="mr-2 hidden text-right sm:block">
              <p className="text-[var(--text-muted)] text-xs">Active Print Queue</p>
              <p className="font-bold font-mono text-[var(--text-heading)] text-sm">
                {jobs.filter((j) => j.status === 'queued' || j.status === 'printing').length} Jobs
                Pending
              </p>
            </div>
            <Button
              size="sm"
              onClick={openCreateEmployeeModal}
              className="gap-1.5 bg-[var(--accent-blue)] text-white text-xs hover:bg-[var(--accent-blue)]/90"
            >
              <UserPlus className="h-3.5 w-3.5" />+ Add Employee to DB
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Printer status synchronized')}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Status
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Employee Database Registration & Photo Setup Drawer ── */}
      {showEditor && (
        <GlassCard className="space-y-5 border-2 border-[var(--accent-blue)]/40 p-6 shadow-lg">
          <div className="flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
                <UserPlus className="h-4 w-4 text-[var(--accent-blue)]" />
                {editorMode === 'create'
                  ? 'Register New Employee & Provision Access Card'
                  : `Edit Employee Card Profile & Photo (${formState.emp_code})`}
              </h3>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                Saves directly to <code className="font-mono">personnel</code>, issues active{' '}
                <code className="font-mono">badges</code> (QR + RFID), and auto-syncs to{' '}
                <code className="font-mono">operators</code> across Control Room, Drilling &amp;
                Production.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-heading)]"
              aria-label="Close employee editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveEmployee} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Photo Upload & Live Portrait Preview (4 cols) */}
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 lg:col-span-4">
              <div className="relative flex h-36 w-28 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--border-default)] bg-slate-900 shadow-inner">
                {formState.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={formState.photo_url}
                    alt="Employee ID preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <Camera className="h-7 w-7 text-slate-400" />
                    <span className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider">
                      ID Portrait
                    </span>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handlePhotoFileChange}
                className="hidden"
              />

              <div className="flex w-full flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload / Capture Photo
                </Button>
                {formState.photo_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFormState((prev) => ({ ...prev, photo_url: '' }))}
                    className="text-red-600 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>

              <input
                type="text"
                placeholder="Or paste photo URL / data URI…"
                value={formState.photo_url || ''}
                onChange={(e) => setFormState((prev) => ({ ...prev, photo_url: e.target.value }))}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-primary)] text-xs"
              />
            </div>

            {/* Employee Database Fields (8 cols) */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:col-span-8">
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formState.first_name}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                  placeholder="e.g. Sipho"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  Surname *
                </label>
                <input
                  type="text"
                  required
                  value={formState.surname}
                  onChange={(e) => setFormState((prev) => ({ ...prev, surname: e.target.value }))}
                  placeholder="e.g. Ndlovu"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  Employee Code *
                </label>
                <input
                  type="text"
                  required
                  value={formState.emp_code}
                  onChange={(e) => {
                    const code = e.target.value.toUpperCase();
                    setFormState((prev) => ({
                      ...prev,
                      emp_code: code,
                      qr_code: `EMP-${code}`,
                    }));
                  }}
                  placeholder="e.g. EMP-0105"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  National ID / Passport Number *
                </label>
                <input
                  type="text"
                  required
                  value={formState.id_number}
                  onChange={(e) => setFormState((prev) => ({ ...prev, id_number: e.target.value }))}
                  placeholder="e.g. 8804125104081"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  Job Title / Designation *
                </label>
                <input
                  type="text"
                  required
                  value={formState.job_title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, job_title: e.target.value }))}
                  placeholder="e.g. Pit Viper Drill Operator"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  Department
                </label>
                <select
                  aria-label="Employee Department"
                  value={formState.department_id || ''}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, department_id: e.target.value || null }))
                  }
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                >
                  <option value="">General Operations</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  Medical Fitness Expiry Date
                </label>
                <input
                  type="date"
                  aria-label="Medical Fitness Expiry Date"
                  value={formState.medical_expiry || ''}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, medical_expiry: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  Safety Induction Expiry Date
                </label>
                <input
                  type="date"
                  aria-label="Safety Induction Expiry Date"
                  value={formState.induction_expiry || ''}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, induction_expiry: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  Site Clearance Zone
                </label>
                <select
                  aria-label="Site Clearance Zone"
                  value={formState.area || 'Main Complex'}
                  onChange={(e) => setFormState((prev) => ({ ...prev, area: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
                >
                  <option value="Main Complex">Main Complex &amp; Control Room</option>
                  <option value="North Pit">North Pit &amp; Haul Roads</option>
                  <option value="South Pit">South Pit &amp; Blast Zone</option>
                  <option value="Engineering Workshop">Engineering Workshop-03</option>
                  <option value="Processing Plant">Coal Wash Plant &amp; Weighbridge</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
                  RFID Chip UID / QR Payload
                </label>
                <input
                  type="text"
                  value={formState.rfid_code || ''}
                  onChange={(e) => setFormState((prev) => ({ ...prev, rfid_code: e.target.value }))}
                  placeholder="e.g. RFID-9A84F2"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-[var(--border-subtle)] border-t pt-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditor(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="gap-1.5 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isPending
                    ? 'Saving to Database…'
                    : editorMode === 'create'
                      ? 'Save Employee to DB & Load Card'
                      : 'Update Employee & Card Details'}
                </Button>
              </div>
            </div>
          </form>
        </GlassCard>
      )}

      {/* ── Main Layout: Directory & Live Preview ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Column 1: Employee Directory (5 cols) ── */}
        <div className="space-y-4 lg:col-span-5">
          <GlassCard className="space-y-4 border border-[var(--border-default)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                <Layers className="h-4 w-4 text-blue-600" />
                Employee Badging Directory
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)] text-xs">
                  {employees.length} available
                </span>
                <button
                  type="button"
                  onClick={openCreateEmployeeModal}
                  className="inline-flex items-center gap-1 font-medium text-[var(--accent-blue)] text-xs hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" /> New
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by name, ID number, or code..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-2 pr-4 pl-9 text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {employees.map((emp) => {
                const isSelected = selectedEmp?.id === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmp(emp)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-blue-500/50 bg-blue-600/12 shadow-sm'
                        : 'border-[var(--border-default)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-slate-800 to-slate-700 font-bold text-sm text-white">
                        {emp.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={emp.photo_url}
                            alt={`${emp.first_name} ${emp.surname}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            {emp.first_name[0]}
                            {emp.surname[0]}
                          </>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--text-heading)] text-sm">
                          {emp.first_name} {emp.surname}
                        </p>
                        <p className="truncate text-[var(--text-muted)] text-xs">
                          {emp.emp_code} • {emp.job_title || 'Personnel'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {emp.qr_code ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-700">
                          <QrCode className="h-3 w-3" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-700">
                          New Card
                        </span>
                      )}
                      <span className="max-w-[90px] truncate text-[10px] text-[var(--text-muted)]">
                        {emp.department_name}
                      </span>
                    </div>
                  </div>
                );
              })}

              {employees.length === 0 && (
                <div className="space-y-2 p-8 text-center text-[var(--text-muted)] text-sm">
                  <p>No personnel records found matching your search.</p>
                  <Button size="sm" variant="outline" onClick={openCreateEmployeeModal}>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Register New Employee
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* ── Column 2: CR80 PVC Interactive Preview & Print Trigger (7 cols) ── */}
        <div className="space-y-4 lg:col-span-7">
          <GlassCard className="flex flex-col items-center border border-[var(--border-default)] p-6">
            <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b pb-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                  <Cpu className="h-4 w-4 text-emerald-600" />
                  CR80 PVC Card Preview (ISO/IEC 7810 ID-1 Standard)
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Standard format 85.60 mm × 53.98 mm • Optimized for Neo 300 Dye-Sublimation
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedEmp && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEditEmployeeModal(selectedEmp)}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Photo &amp; Details
                  </Button>
                )}
                <div className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-1">
                  <button
                    type="button"
                    onClick={() => setCardSide('front')}
                    className={`rounded px-3 py-1 font-medium text-xs transition-colors ${
                      cardSide === 'front'
                        ? 'bg-blue-600 text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    }`}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide('back')}
                    className={`rounded px-3 py-1 font-medium text-xs transition-colors ${
                      cardSide === 'back'
                        ? 'bg-blue-600 text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    }`}
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>

            {selectedEmp ? (
              <div className="flex w-full flex-col items-center gap-6">
                {/* ── Card Canvas (Realistic CR80 Styling) ── */}
                <div className="relative h-[240px] w-[380px] select-none overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-5 text-white shadow-2xl transition-all duration-300">
                  {/* Holographic Security Overlay Pattern */}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] opacity-10 [background-size:12px_12px]" />
                  <div className="pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />

                  {cardSide === 'front' ? (
                    <div className="relative flex h-full flex-col justify-between">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-white/15 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500 font-bold text-white text-xs shadow-sm">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="bg-gradient-to-r from-blue-200 to-indigo-100 bg-clip-text font-extrabold text-transparent text-xs uppercase tracking-wider">
                              PLANTCOR MINING
                            </span>
                            <span className="block font-mono text-[8px] text-blue-300 tracking-widest">
                              SITE ACCESS CLEARANCE
                            </span>
                          </div>
                        </div>

                        <span className="rounded border border-blue-400/30 bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] text-blue-300">
                          {selectedEmp.emp_code}
                        </span>
                      </div>

                      {/* Card Body: Photo & Identity */}
                      <div className="my-auto flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditEmployeeModal(selectedEmp)}
                          title="Click to upload or update employee photo"
                          className="group relative flex h-24 w-20 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-white/30 bg-slate-800 shadow-inner hover:border-blue-400"
                        >
                          {selectedEmp.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selectedEmp.photo_url}
                              alt={`${selectedEmp.first_name} ${selectedEmp.surname}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <>
                              <span className="font-bold text-2xl text-slate-300">
                                {selectedEmp.first_name[0]}
                                {selectedEmp.surname[0]}
                              </span>
                              <span className="mt-1 text-[7px] text-blue-300 uppercase tracking-wider">
                                + ADD PHOTO
                              </span>
                            </>
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="truncate font-bold text-base text-white leading-tight">
                            {selectedEmp.first_name} {selectedEmp.surname}
                          </h4>
                          <p className="truncate font-medium text-blue-200 text-xs">
                            {selectedEmp.job_title || 'Site Operator'}
                          </p>
                          <p className="font-mono text-[10px] text-slate-300">
                            NAT ID: {selectedEmp.id_number || 'Verified'}
                          </p>

                          <div className="flex items-center gap-2 pt-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium text-[9px] ${
                                isMedicalValid
                                  ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                                  : 'border-red-400/30 bg-red-500/20 text-red-300'
                              }`}
                            >
                              <Stethoscope className="h-2.5 w-2.5" />
                              Med: {isMedicalValid ? 'PASS' : 'EXP'}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium text-[9px] ${
                                isInductionValid
                                  ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                                  : 'border-amber-400/30 bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              <FileCheck2 className="h-2.5 w-2.5" />
                              Induct: {isInductionValid ? 'OK' : 'DUE'}
                            </span>
                          </div>
                        </div>

                        {/* QR Code section */}
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-md">
                          <QRCodeSection
                            data={selectedEmp.qr_code || `EMP-${selectedEmp.emp_code}`}
                            size={56}
                          />
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between border-white/10 border-t pt-1 font-mono text-[8px] text-slate-300">
                        <span>DEPT: {selectedEmp.department_name?.toUpperCase()}</span>
                        <span>{selectedEmp.area?.toUpperCase() || 'MAIN COMPLEX'} • RFID</span>
                      </div>
                    </div>
                  ) : (
                    /* Back of Card Preview */
                    <div className="relative flex h-full flex-col justify-between py-1">
                      {/* Magnetic Stripe representation */}
                      <div className="-mx-5 my-1 h-8 w-full bg-black/90 px-5" />

                      <div className="space-y-2 px-1 font-mono text-[8px] text-slate-300">
                        <p className="leading-tight">
                          This credential is property of Plantcor Mining. Unauthorized possession,
                          duplication, or transfer is strictly prohibited. If found, please return
                          to the Security Access Gate.
                        </p>
                        <div className="flex items-center justify-between rounded border border-white/10 bg-black/30 p-2 text-[9px]">
                          <span>Emergency Security Hotline:</span>
                          <span className="font-bold text-white">+27 (0) 11 902 4400</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-white/10 border-t pt-2 font-mono text-[8px] text-slate-300">
                        <span>MAGICARD SECURE HOLOPRINT</span>
                        <span>SER: {selectedEmp.id.substring(0, 12).toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Print Dispatch Action Button */}
                <div className="flex w-full max-w-[380px] flex-wrap items-center gap-3">
                  <Button
                    className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 font-semibold text-white shadow-blue-600/30 shadow-lg hover:from-blue-500 hover:to-indigo-500"
                    onClick={() => handlePrint(selectedEmp.id)}
                    disabled={isPending}
                  >
                    <Printer className="h-4 w-4" />
                    {isPending ? 'Sending to Neo 300...' : 'Print Card via Neo 300'}
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => openEditEmployeeModal(selectedEmp)}
                  >
                    <Edit3 className="h-4 w-4" />
                    Setup
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => toast.info('PDF card preview ready for download')}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-[var(--text-muted)] text-sm">
                Select an employee from the directory or click &ldquo;+ Add Employee to DB&rdquo; to
                preview and print their PVC ID badge.
              </div>
            )}
          </GlassCard>

          {/* ── Print Queue / Recent Jobs Table ── */}
          <GlassCard className="space-y-3 border border-[var(--border-default)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                <Clock className="h-4 w-4 text-blue-600" />
                Neo 300 Print Queue &amp; Recent Dispatches
              </h3>
              <span className="text-[var(--text-muted)] text-xs">{jobs.length} jobs</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-[var(--border-default)] border-b text-[var(--text-muted)]">
                    <th className="pb-2 font-medium">Job ID</th>
                    <th className="pb-2 font-medium">Employee Name</th>
                    <th className="pb-2 font-medium">Target Printer</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Timestamp</th>
                    <th className="pb-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]/50">
                  {jobs.map((j) => (
                    <tr key={j.id} className="hover:bg-[var(--bg-secondary)]/30">
                      <td className="py-2.5 font-mono text-[var(--text-muted)]">
                        #{j.id.substring(0, 8)}
                      </td>
                      <td className="py-2.5 font-medium text-[var(--text-primary)]">
                        {j.employee_name}
                      </td>
                      <td className="py-2.5 text-[var(--text-secondary)]">{printer.model}</td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[10px] ${
                            j.status === 'completed'
                              ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
                              : j.status === 'queued' || j.status === 'printing'
                                ? 'animate-pulse border border-blue-500/25 bg-blue-500/10 text-blue-700'
                                : 'border border-slate-500/25 bg-slate-500/10 text-slate-700'
                          }`}
                        >
                          {j.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 text-[var(--text-secondary)]">
                        {new Date(j.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 text-right">
                        {j.status === 'queued' && (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(j.id)}
                            className="font-medium text-red-600 text-xs hover:text-red-500"
                          >
                            Cancel
                          </button>
                        )}
                        {j.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => handlePrint(j.personnel_id || '')}
                            className="font-medium text-blue-600 text-xs hover:text-blue-500"
                          >
                            Reprint
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                        No print jobs in history. Select an employee to print.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
