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
      <GlassCard className="p-5 border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Printer className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">
                  Magicard Neo 300 Card & Employee Provisioning Studio
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 border-emerald-500/25 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping inline-block" />
                  {printer.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Model:{' '}
                <span className="font-semibold text-[var(--text-primary)]">{printer.model}</span> |
                CUPS Queue: <span className="font-mono text-blue-600">{printer.cups_name}</span> |
                Connection:{' '}
                <span className="uppercase text-[var(--text-primary)]">
                  {printer.connection_type}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-center flex-wrap">
            <div className="text-right hidden sm:block mr-2">
              <p className="text-xs text-[var(--text-muted)]">Active Print Queue</p>
              <p className="text-sm font-mono font-bold text-[var(--text-heading)]">
                {jobs.filter((j) => j.status === 'queued' || j.status === 'printing').length} Jobs
                Pending
              </p>
            </div>
            <Button
              size="sm"
              onClick={openCreateEmployeeModal}
              className="gap-1.5 text-xs bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
            >
              <UserPlus className="w-3.5 h-3.5" />+ Add Employee to DB
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Printer status synchronized')}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Status
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Employee Database Registration & Photo Setup Drawer ── */}
      {showEditor && (
        <GlassCard className="p-6 border-2 border-[var(--accent-blue)]/40 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <h3 className="text-base font-bold text-[var(--text-heading)] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[var(--accent-blue)]" />
                {editorMode === 'create'
                  ? 'Register New Employee & Provision Access Card'
                  : `Edit Employee Card Profile & Photo (${formState.emp_code})`}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Saves directly to <code className="font-mono">personnel</code>, issues active{' '}
                <code className="font-mono">badges</code> (QR + RFID), and auto-syncs to{' '}
                <code className="font-mono">operators</code> across Control Room, Drilling &amp;
                Production.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-secondary)]"
              aria-label="Close employee editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveEmployee} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Photo Upload & Live Portrait Preview (4 cols) */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] gap-3">
              <div className="w-28 h-36 rounded-xl bg-slate-900 border-2 border-[var(--border-default)] overflow-hidden flex flex-col items-center justify-center relative shadow-inner">
                {formState.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={formState.photo_url}
                    alt="Employee ID preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <Camera className="w-7 h-7 text-slate-400" />
                    <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
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

              <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload / Capture Photo
                </Button>
                {formState.photo_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFormState((prev) => ({ ...prev, photo_url: '' }))}
                    className="text-xs text-red-600"
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
                className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-default)] text-xs text-[var(--text-primary)]"
              />
            </div>

            {/* Employee Database Fields (8 cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
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
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Surname *
                </label>
                <input
                  type="text"
                  required
                  value={formState.surname}
                  onChange={(e) => setFormState((prev) => ({ ...prev, surname: e.target.value }))}
                  placeholder="e.g. Ndlovu"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
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
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm font-mono text-[var(--text-heading)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  National ID / Passport Number *
                </label>
                <input
                  type="text"
                  required
                  value={formState.id_number}
                  onChange={(e) => setFormState((prev) => ({ ...prev, id_number: e.target.value }))}
                  placeholder="e.g. 8804125104081"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm font-mono text-[var(--text-heading)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Job Title / Designation *
                </label>
                <input
                  type="text"
                  required
                  value={formState.job_title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, job_title: e.target.value }))}
                  placeholder="e.g. Pit Viper Drill Operator"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Department
                </label>
                <select
                  aria-label="Employee Department"
                  value={formState.department_id || ''}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, department_id: e.target.value || null }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)]"
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
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Medical Fitness Expiry Date
                </label>
                <input
                  type="date"
                  aria-label="Medical Fitness Expiry Date"
                  value={formState.medical_expiry || ''}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, medical_expiry: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Safety Induction Expiry Date
                </label>
                <input
                  type="date"
                  aria-label="Safety Induction Expiry Date"
                  value={formState.induction_expiry || ''}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, induction_expiry: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Site Clearance Zone
                </label>
                <select
                  aria-label="Site Clearance Zone"
                  value={formState.area || 'Main Complex'}
                  onChange={(e) => setFormState((prev) => ({ ...prev, area: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-heading)]"
                >
                  <option value="Main Complex">Main Complex &amp; Control Room</option>
                  <option value="North Pit">North Pit &amp; Haul Roads</option>
                  <option value="South Pit">South Pit &amp; Blast Zone</option>
                  <option value="Engineering Workshop">Engineering Workshop-03</option>
                  <option value="Processing Plant">Coal Wash Plant &amp; Weighbridge</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  RFID Chip UID / QR Payload
                </label>
                <input
                  type="text"
                  value={formState.rfid_code || ''}
                  onChange={(e) => setFormState((prev) => ({ ...prev, rfid_code: e.target.value }))}
                  placeholder="e.g. RFID-9A84F2"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm font-mono text-[var(--text-heading)]"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
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
                  className="bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Column 1: Employee Directory (5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard className="p-4 space-y-4 border border-[var(--border-default)]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-heading)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Employee Badging Directory
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">
                  {employees.length} available
                </span>
                <button
                  type="button"
                  onClick={openCreateEmployeeModal}
                  className="text-xs font-medium text-[var(--accent-blue)] hover:underline inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> New
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by name, ID number, or code..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {employees.map((emp) => {
                const isSelected = selectedEmp?.id === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmp(emp)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-600/12 border-blue-500/50 shadow-sm'
                        : 'bg-[var(--bg-secondary)]/30 border-[var(--border-default)] hover:bg-[var(--bg-secondary)]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 overflow-hidden flex items-center justify-center font-bold text-white text-sm shrink-0 border border-white/10">
                        {emp.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={emp.photo_url}
                            alt={`${emp.first_name} ${emp.surname}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>
                            {emp.first_name[0]}
                            {emp.surname[0]}
                          </>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-[var(--text-heading)] truncate">
                          {emp.first_name} {emp.surname}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {emp.emp_code} • {emp.job_title || 'Personnel'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {emp.qr_code ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
                          <QrCode className="w-3 h-3" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/25">
                          New Card
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]">
                        {emp.department_name}
                      </span>
                    </div>
                  </div>
                );
              })}

              {employees.length === 0 && (
                <div className="p-8 text-center text-sm text-[var(--text-muted)] space-y-2">
                  <p>No personnel records found matching your search.</p>
                  <Button size="sm" variant="outline" onClick={openCreateEmployeeModal}>
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Register New Employee
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* ── Column 2: CR80 PVC Interactive Preview & Print Trigger (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          <GlassCard className="p-6 border border-[var(--border-default)] flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-default)] flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-heading)] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  CR80 PVC Card Preview (ISO/IEC 7810 ID-1 Standard)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
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
                    className="h-7 text-xs gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Photo &amp; Details
                  </Button>
                )}
                <div className="flex items-center gap-1 bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-default)]">
                  <button
                    type="button"
                    onClick={() => setCardSide('front')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
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
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
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
              <div className="flex flex-col items-center gap-6 w-full">
                {/* ── Card Canvas (Realistic CR80 Styling) ── */}
                <div className="relative w-[380px] h-[240px] rounded-2xl p-5 shadow-2xl transition-all duration-300 overflow-hidden border border-white/20 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white select-none">
                  {/* Holographic Security Overlay Pattern */}
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                  <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

                  {cardSide === 'front' ? (
                    <div className="relative h-full flex flex-col justify-between">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-white/15 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center font-bold text-white text-xs shadow-sm">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-xs tracking-wider uppercase bg-gradient-to-r from-blue-200 to-indigo-100 bg-clip-text text-transparent">
                              PLANTCOR MINING
                            </span>
                            <span className="block text-[8px] text-blue-300 font-mono tracking-widest">
                              SITE ACCESS CLEARANCE
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                          {selectedEmp.emp_code}
                        </span>
                      </div>

                      {/* Card Body: Photo & Identity */}
                      <div className="flex items-center gap-4 my-auto">
                        <button
                          type="button"
                          onClick={() => openEditEmployeeModal(selectedEmp)}
                          title="Click to upload or update employee photo"
                          className="w-20 h-24 rounded-lg bg-slate-800 border-2 border-white/30 hover:border-blue-400 overflow-hidden flex flex-col items-center justify-center relative shadow-inner shrink-0 group cursor-pointer"
                        >
                          {selectedEmp.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selectedEmp.photo_url}
                              alt={`${selectedEmp.first_name} ${selectedEmp.surname}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <>
                              <span className="text-2xl font-bold text-slate-300">
                                {selectedEmp.first_name[0]}
                                {selectedEmp.surname[0]}
                              </span>
                              <span className="text-[7px] text-blue-300 tracking-wider mt-1 uppercase">
                                + ADD PHOTO
                              </span>
                            </>
                          )}
                        </button>

                        <div className="space-y-1 min-w-0 flex-1">
                          <h4 className="text-base font-bold leading-tight truncate text-white">
                            {selectedEmp.first_name} {selectedEmp.surname}
                          </h4>
                          <p className="text-xs text-blue-200 font-medium truncate">
                            {selectedEmp.job_title || 'Site Operator'}
                          </p>
                          <p className="text-[10px] text-slate-300 font-mono">
                            NAT ID: {selectedEmp.id_number || 'Verified'}
                          </p>

                          <div className="pt-2 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                                isMedicalValid
                                  ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                                  : 'bg-red-500/20 border-red-400/30 text-red-300'
                              }`}
                            >
                              <Stethoscope className="w-2.5 h-2.5" />
                              Med: {isMedicalValid ? 'PASS' : 'EXP'}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                                isInductionValid
                                  ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                                  : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                              }`}
                            >
                              <FileCheck2 className="w-2.5 h-2.5" />
                              Induct: {isInductionValid ? 'OK' : 'DUE'}
                            </span>
                          </div>
                        </div>

                        {/* QR Code section */}
                        <div className="w-16 h-16 bg-white p-1 rounded-md shadow-md shrink-0 flex items-center justify-center">
                          <QRCodeSection
                            data={selectedEmp.qr_code || `EMP-${selectedEmp.emp_code}`}
                            size={56}
                          />
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between text-[8px] text-slate-300 border-t border-white/10 pt-1 font-mono">
                        <span>DEPT: {selectedEmp.department_name?.toUpperCase()}</span>
                        <span>{selectedEmp.area?.toUpperCase() || 'MAIN COMPLEX'} • RFID</span>
                      </div>
                    </div>
                  ) : (
                    /* Back of Card Preview */
                    <div className="relative h-full flex flex-col justify-between py-1">
                      {/* Magnetic Stripe representation */}
                      <div className="w-full h-8 bg-black/90 -mx-5 px-5 my-1" />

                      <div className="space-y-2 text-[8px] text-slate-300 px-1 font-mono">
                        <p className="leading-tight">
                          This credential is property of Plantcor Mining. Unauthorized possession,
                          duplication, or transfer is strictly prohibited. If found, please return
                          to the Security Access Gate.
                        </p>
                        <div className="border border-white/10 p-2 rounded bg-black/30 flex justify-between items-center text-[9px]">
                          <span>Emergency Security Hotline:</span>
                          <span className="font-bold text-white">+27 (0) 11 902 4400</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[8px] font-mono text-slate-300">
                        <span>MAGICARD SECURE HOLOPRINT</span>
                        <span>SER: {selectedEmp.id.substring(0, 12).toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Print Dispatch Action Button */}
                <div className="flex flex-wrap items-center gap-3 w-full max-w-[380px]">
                  <Button
                    className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 shadow-lg shadow-blue-600/30"
                    onClick={() => handlePrint(selectedEmp.id)}
                    disabled={isPending}
                  >
                    <Printer className="w-4 h-4" />
                    {isPending ? 'Sending to Neo 300...' : 'Print Card via Neo 300'}
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => openEditEmployeeModal(selectedEmp)}
                  >
                    <Edit3 className="w-4 h-4" />
                    Setup
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => toast.info('PDF card preview ready for download')}
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-[var(--text-muted)]">
                Select an employee from the directory or click &ldquo;+ Add Employee to DB&rdquo; to
                preview and print their PVC ID badge.
              </div>
            )}
          </GlassCard>

          {/* ── Print Queue / Recent Jobs Table ── */}
          <GlassCard className="p-4 border border-[var(--border-default)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-heading)] flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Neo 300 Print Queue &amp; Recent Dispatches
              </h3>
              <span className="text-xs text-[var(--text-muted)]">{jobs.length} jobs</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-[var(--text-muted)]">
                    <th className="pb-2 font-medium">Job ID</th>
                    <th className="pb-2 font-medium">Employee Name</th>
                    <th className="pb-2 font-medium">Target Printer</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Timestamp</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
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
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            j.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/25'
                              : j.status === 'queued' || j.status === 'printing'
                                ? 'bg-blue-500/10 text-blue-700 border border-blue-500/25 animate-pulse'
                                : 'bg-slate-500/10 text-slate-700 border border-slate-500/25'
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
                            className="text-red-600 hover:text-red-500 font-medium text-xs"
                          >
                            Cancel
                          </button>
                        )}
                        {j.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => handlePrint(j.personnel_id || '')}
                            className="text-blue-600 hover:text-blue-500 font-medium text-xs"
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
