'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  CheckCircle2,
  Layers,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Truck,
  Usb,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { QRCodeSection } from '../components/QRCodeSection';
import type {
  CardPrintJob,
  CardStudioDepartment,
  EmployeeCardProfile,
  FleetCardBadgeCategory,
  FleetCardBadgeProfile,
  Neo300Printer,
  UpsertEmployeeCardInput,
} from './actions';
import {
  cancelNeo300Job,
  getEmployeeCardProfiles,
  getNeo300PrinterStatus,
  sendNeo300PrintJob,
  upsertEmployeeForCardPrinting,
} from './actions';
import { Neo300EmployeeEditorModal } from './Neo300EmployeeEditorModal';
import { Neo300PrinterQueuePanel } from './Neo300PrinterQueuePanel';

type DirectoryTabKey = 'employees' | FleetCardBadgeCategory;

const FLEET_TAB_CONFIG: ReadonlyArray<{
  readonly key: FleetCardBadgeCategory;
  readonly label: string;
  readonly emptyTitle: string;
}> = [
  { key: 'vehicle', label: 'Vehicle', emptyTitle: 'No general vehicles found' },
  { key: 'company-fleet', label: 'Company Fleet', emptyTitle: 'No company fleet vehicles found' },
  { key: 'coal-trucks', label: 'Coal Trucks', emptyTitle: 'No coal haul trucks found' },
];

const DIRECTORY_CARD_BASE =
  'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all';
const DIRECTORY_CARD_SELECTED = 'border-blue-500/50 bg-blue-600/12 shadow-sm';
const DIRECTORY_CARD_DEFAULT =
  'border-[var(--border-default)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/60';
const SEARCH_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-2 pr-4 pl-9 text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40';

function createEmptyEmployeeForm(
  departments: readonly CardStudioDepartment[]
): UpsertEmployeeCardInput {
  return {
    emp_code: '',
    coy_number: '',
    first_name: '',
    surname: '',
    id_number: '',
    job_title: '',
    department_id: departments[0]?.id ?? null,
    area: '',
    status: 'Active',
    medical_expiry: null,
    induction_expiry: null,
    photo_url: '',
    rfid_code: '',
    qr_code: '',
  };
}

interface Neo300PrintStudioProps {
  initialPrinter: Neo300Printer;
  initialEmployees: EmployeeCardProfile[];
  initialJobs: CardPrintJob[];
  departments?: CardStudioDepartment[];
  initialFleetBadges?: FleetCardBadgeProfile[];
}

function FleetBadgeTabList({
  items,
  emptyTitle,
  searchTerm,
  onSearchChange,
}: {
  readonly items: readonly FleetCardBadgeProfile[];
  readonly emptyTitle: string;
  readonly searchTerm: string;
  readonly onSearchChange: (nextValue: string) => void;
}) {
  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.vehicle_type.toLowerCase().includes(query) ||
        (item.registration_number ?? '').toLowerCase().includes(query) ||
        (item.qr_code ?? '').toLowerCase().includes(query)
    );
  }, [items, searchTerm]);

  return (
    <div className="space-y-3 pt-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Filter unit code, registration, or QR..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={SEARCH_INPUT_CLASS}
        />
      </div>

      <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
        {filteredItems.map((unit) => (
          <div key={unit.id} className={`${DIRECTORY_CARD_BASE} ${DIRECTORY_CARD_DEFAULT}`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--text-heading)] text-sm">
                  {unit.code} • {unit.vehicle_type}
                </p>
                <p className="truncate text-[var(--text-muted)] text-xs">
                  {unit.make_model || 'Site Unit'}
                  {unit.registration_number ? ` • Reg: ${unit.registration_number}` : ''}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              {unit.qr_code ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-700">
                  <QrCode className="h-3 w-3" />
                  {unit.qr_code}
                </span>
              ) : (
                <Link
                  href="/access-control/qr-codes"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-[10px] text-amber-800 hover:bg-amber-500/20"
                >
                  Issue QR Tag
                </Link>
              )}
              <span className="text-[10px] text-[var(--text-muted)] capitalize">{unit.status}</span>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="space-y-2 rounded-xl border border-[var(--border-default)] border-dashed p-6 text-center text-[var(--text-muted)] text-xs">
            <p className="font-medium text-[var(--text-heading)]">{emptyTitle}</p>
            <p>Assign vehicle &amp; truck QR credentials directly in the QR &amp; RFID studio.</p>
            <Link
              href="/access-control/qr-codes"
              className="inline-flex items-center gap-1 font-semibold text-[var(--accent-blue)] hover:underline"
            >
              <QrCode className="h-3.5 w-3.5" />
              Open QR &amp; RFID Studio
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function Neo300PrintStudio({
  initialPrinter,
  initialEmployees,
  initialJobs,
  departments = [],
  initialFleetBadges = [],
}: Neo300PrintStudioProps) {
  const [printer, setPrinter] = useState<Neo300Printer>(initialPrinter);
  const [directoryTab, setDirectoryTab] = useState<DirectoryTabKey>('employees');
  const [showUsbSetup, setShowUsbSetup] = useState(false);
  const [employees, setEmployees] = useState<EmployeeCardProfile[]>(initialEmployees);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeCardProfile | null>(
    initialEmployees[0] ?? null
  );
  const [jobs, setJobs] = useState<CardPrintJob[]>(initialJobs);
  const [search, setSearch] = useState('');
  const [fleetSearch, setFleetSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [isPending, startTransition] = useTransition();

  const [formState, setFormState] = useState<UpsertEmployeeCardInput>(() =>
    createEmptyEmployeeForm(departments)
  );

  const fleetByCategory = useMemo(() => {
    const grouped: Record<FleetCardBadgeCategory, FleetCardBadgeProfile[]> = {
      vehicle: [],
      'company-fleet': [],
      'coal-trucks': [],
    };
    for (const unit of initialFleetBadges) {
      grouped[unit.category].push(unit);
    }
    return grouped;
  }, [initialFleetBadges]);

  const openCreateEmployeeModal = () => {
    setEditorMode('create');
    setFormState(createEmptyEmployeeForm(departments));
    setShowEditor(true);
  };

  const openEditEmployeeModal = (emp: EmployeeCardProfile) => {
    setEditorMode('edit');
    setFormState({
      id: emp.id,
      emp_code: emp.emp_code,
      coy_number: emp.coy_number || emp.emp_code,
      first_name: emp.first_name,
      surname: emp.surname,
      id_number: emp.id_number,
      job_title: emp.job_title ?? '',
      department_id: emp.department_id ?? null,
      area: emp.area ?? '',
      status: emp.status,
      medical_expiry: emp.medical_expiry ?? null,
      induction_expiry: emp.induction_expiry ?? null,
      photo_url: emp.photo_url ?? '',
      rfid_code: emp.rfid_code ?? '',
      qr_code: emp.qr_code ?? '',
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
            `Print job queued for ${printer.model} (${selectedEmp?.first_name} ${selectedEmp?.surname})`
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
      } catch {
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
              <Printer className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[var(--text-heading)] text-xl tracking-tight">
                  Magicard Neo 300 Card & Employee Provisioning Studio
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700 text-xs">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
                  {printer.status.toUpperCase()}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUsbSetup((prev) => !prev)}
                  className="gap-1.5 text-xs"
                >
                  <Usb className="h-3.5 w-3.5" />
                  Setup USB Connection
                </Button>
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
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const latest = await getNeo300PrinterStatus();
                    setPrinter(latest);
                    toast.info(`Printer status: ${latest.status.toUpperCase()}`, {
                      description: latest.status_message ?? undefined,
                    });
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : 'Failed to check printer status'
                    );
                  }
                });
              }}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Status
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Expandable USB & CUPS Driver Setup Guide ── */}
      {showUsbSetup && (
        <GlassCard className="space-y-3 border border-blue-200 bg-white/90 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                <Usb className="h-4 w-4 text-blue-600" />
                USB &amp; CUPS Printer Setup ({printer.model})
              </h3>
              <p className="text-[var(--text-muted)] text-xs">
                Queue <span className="font-mono">{printer.cups_name}</span> • Transport:{' '}
                <span className="font-mono uppercase">{printer.connection_type}</span> • Status:{' '}
                {printer.status_message || 'Ready to print ID cards'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const latest = await getNeo300PrinterStatus();
                      setPrinter(latest);
                      if (latest.status === 'online') {
                        toast.success(`Bridge heartbeat online for ${latest.cups_name}`);
                      } else {
                        toast.warning(
                          latest.status_message ??
                            'Printer bridge offline — jobs queue cleanly until local bridge connects.'
                        );
                      }
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : 'Failed to verify printer bridge'
                      );
                    }
                  });
                }}
                className="gap-1.5 bg-blue-600 text-white text-xs hover:bg-blue-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Check Bridge Heartbeat
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowUsbSetup(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 text-[var(--text-secondary)] text-xs md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-3">
              <p className="font-semibold text-[var(--text-heading)]">1. Direct USB Cable</p>
              <p className="mt-1">
                Connect Magicard Neo 300 via USB-B directly to the security workstation port.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-3">
              <p className="font-semibold text-[var(--text-heading)]">2. CUPS Spooler Queue</p>
              <p className="mt-1">
                Ensure local print daemon exposes queue{' '}
                <span className="font-mono">{printer.cups_name}</span> with CR80 300dpi media.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-3">
              <p className="font-semibold text-[var(--text-heading)]">3. Ribbon &amp; Hoppers</p>
              <p className="mt-1">
                Verify color dye-film ribbon and blank PVC cards are seated in the input hopper.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

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
        {/* ── Column 1: Credential Directory Tabs (5 cols) ── */}
        <div className="space-y-4 lg:col-span-5">
          <GlassCard className="space-y-4 border border-[var(--border-default)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
                <Layers className="h-4 w-4 text-blue-600" />
                Badging &amp; Fleet Directory
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)] text-xs">
                  {employees.length} staff • {initialFleetBadges.length} fleet
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

            <Tabs
              value={directoryTab}
              onValueChange={(value) => setDirectoryTab(value as DirectoryTabKey)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="employees" className="px-2 font-medium text-xs">
                  Employees
                </TabsTrigger>
                <TabsTrigger value="vehicle" className="px-2 font-medium text-xs">
                  Vehicle
                </TabsTrigger>
                <TabsTrigger value="company-fleet" className="px-2 font-medium text-xs">
                  Company Fleet
                </TabsTrigger>
                <TabsTrigger value="coal-trucks" className="px-2 font-medium text-xs">
                  Coal Trucks
                </TabsTrigger>
              </TabsList>

              <TabsContent value="employees" className="mt-3 space-y-3">
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search by name, ID number, or code..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className={SEARCH_INPUT_CLASS}
                  />
                </div>

                <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                  {employees.map((emp) => {
                    const isSelected = selectedEmp?.id === emp.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmp(emp)}
                        className={`${DIRECTORY_CARD_BASE} ${
                          isSelected ? DIRECTORY_CARD_SELECTED : DIRECTORY_CARD_DEFAULT
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            data-testid={`employee-row-qr-${emp.id}`}
                            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-accent-gold/55 bg-white p-0.5 shadow-2xs"
                          >
                            {emp.qr_code ? (
                              <QRCodeSection data={emp.qr_code} size={38} />
                            ) : (
                              <span className="px-1 text-center font-mono text-[8px] text-[var(--text-muted)]">
                                NO QR
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--text-heading)] text-sm">
                              {emp.first_name} {emp.surname}
                            </p>
                            <p className="truncate text-[var(--text-muted)] text-xs">
                              COY: {emp.coy_number || emp.emp_code} • {emp.job_title || 'Personnel'}
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
              </TabsContent>

              {FLEET_TAB_CONFIG.map((tab) => (
                <TabsContent key={tab.key} value={tab.key}>
                  <FleetBadgeTabList
                    items={fleetByCategory[tab.key]}
                    emptyTitle={tab.emptyTitle}
                    searchTerm={fleetSearch}
                    onSearchChange={setFleetSearch}
                  />
                </TabsContent>
              ))}
            </Tabs>
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
