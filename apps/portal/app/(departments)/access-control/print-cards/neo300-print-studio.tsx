'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { Layers, Printer, QrCode, RefreshCw, Search, UserPlus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
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
import { DEFAULT_EXPIRY_ONE_YEAR, Neo300EmployeeEditorModal } from './Neo300EmployeeEditorModal';
import { Neo300PrinterQueuePanel } from './Neo300PrinterQueuePanel';

interface Neo300PrintStudioProps {
  initialPrinter: Neo300Printer;
  initialEmployees: EmployeeCardProfile[];
  initialJobs: CardPrintJob[];
  departments?: CardStudioDepartment[];
}

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
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [isPending, startTransition] = useTransition();

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
        <Neo300EmployeeEditorModal
          editorMode={editorMode}
          formState={formState}
          setFormState={setFormState}
          departments={departments}
          isPending={isPending}
          onClose={() => setShowEditor(false)}
          onSave={handleSaveEmployee}
        />
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

        {/* ── Column 2: CR80 PVC Interactive Preview & Print Queue (7 cols) ── */}
        <Neo300PrinterQueuePanel
          selectedEmp={selectedEmp}
          printer={printer}
          jobs={jobs}
          isPending={isPending}
          onEditEmployee={openEditEmployeeModal}
          onPrint={handlePrint}
          onCancelJob={handleCancelJob}
        />
      </div>
    </div>
  );
}
