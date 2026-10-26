'use client';

import {
  machineOperatorScanRequestSchema,
  machineOperatorScanResponseSchema,
  z,
} from '@repo/contract';
import { ContextCardTrigger } from '@repo/ui/components/ui/context-card';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const scanErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

type MachinePreview = Extract<
  z.infer<typeof machineOperatorScanResponseSchema>,
  { stage: 'machine' }
>['machine'];
type EligibleOperator = Extract<
  z.infer<typeof machineOperatorScanResponseSchema>,
  { stage: 'operators' }
>['operators'][number];
type Assignment = Extract<
  z.infer<typeof machineOperatorScanResponseSchema>,
  { stage: 'assignment' }
>;

interface ControlRoomMachine {
  id: string;
  name: string;
  machine_type: string;
  site_id: string | null;
}

interface ControlRoomSite {
  id: string;
  name: string;
}

export function isAdtOrDumpTruck(type: string): boolean {
  const t = type
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const words = t.split(/\s+/);
  return (
    words.includes('adt') || t.includes('dump') || t.includes('truck') || t.includes('articulated')
  );
}

export function getOperatorPlaceholder(
  machine: MachinePreview | null,
  isLoading: boolean,
  hasOperators: boolean,
  isAdt: boolean
): string {
  if (!machine) return 'Choose a machine first…';
  if (isLoading) return 'Loading cleared operators…';
  if (hasOperators) {
    return isAdt ? 'Choose cleared ADT operator…' : 'Choose cleared, matching operator…';
  }
  return isAdt ? 'No cleared ADT operators' : 'No cleared type-matched operators';
}

export function getAssignmentCapabilityNote(machine: Assignment['machine']): string {
  const requiresLoads =
    machine.machineCapabilities?.requiresHourlyLoads ?? machine.requiresHourlyLoads;
  if (requiresLoads) {
    return ' This machine is included automatically in Hourly Loads.';
  }
  if (machine.machineCapabilities?.tracksBenchClearance) {
    return ' This machine tracks bench clearance and blade push metrics.';
  }
  return '';
}

function getOperatorSectionHeading(machine: MachinePreview | null, isAdtMachine: boolean): string {
  if (isAdtMachine) return 'an ADT';
  if (machine) return `a ${machine.machineType}`;
  return 'a machine';
}

async function parseScanErrorResponse(response: Response): Promise<string> {
  const body: unknown = await response.json();
  const parsed = scanErrorSchema.safeParse(body);
  if (!parsed.success) return 'The assignment request failed. Please try again.';
  if (parsed.data.code === 'SITE_REQUIRED') return 'Choose the machine site before assigning.';
  return parsed.data.error;
}

function ScannerHeader({
  showReset,
  isSubmitting,
  onReset,
}: {
  showReset: boolean;
  isSubmitting: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-2 font-medium text-[var(--text-heading)] text-lg">
          Machine &amp; Operator Assignment
        </h3>
        <ContextCardTrigger
          side="bottom"
          align="center"
          delay={100}
          content={
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Select a machine to filter and assign qualified operators. When an ADT machine is
              selected, operators are automatically filtered to show certified ADT operators with
              current medical and induction clearances.
            </p>
          }
          render={<Info className="ml-2 h-4 w-4 text-[var(--accent-blue)]" />}
        />
      </div>
      {showReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 text-[var(--text-secondary)] text-sm hover:text-[var(--text-heading)] disabled:opacity-50"
        >
          <RefreshCw size={15} />
          Reset
        </button>
      )}
    </div>
  );
}

function MachineSelector({
  machines,
  selectedMachineId,
  isSubmitting,
  onSelectMachine,
}: {
  machines: ControlRoomMachine[];
  selectedMachineId: string;
  isSubmitting: boolean;
  onSelectMachine: (machineId: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h4 className="font-medium text-[var(--text-secondary)] text-sm">1. Select a machine</h4>
      <select
        aria-label="Machine"
        value={selectedMachineId}
        disabled={isSubmitting}
        onChange={(event) => onSelectMachine(event.target.value)}
        className="min-h-12 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)]"
      >
        <option value="">Choose active machine…</option>
        {machines.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.machine_type}
          </option>
        ))}
      </select>
    </section>
  );
}

function OperatorSelector({
  machine,
  isAdtMachine,
  selectedOperatorId,
  eligibleOperators,
  isLoadingOperators,
  isSubmitting,
  onSelectOperator,
  onAssign,
}: {
  machine: MachinePreview | null;
  isAdtMachine: boolean;
  selectedOperatorId: string;
  eligibleOperators: EligibleOperator[];
  isLoadingOperators: boolean;
  isSubmitting: boolean;
  onSelectOperator: (operatorId: string) => void;
  onAssign: () => void;
}) {
  const placeholder = getOperatorPlaceholder(
    machine,
    isLoadingOperators,
    eligibleOperators.length > 0,
    isAdtMachine
  );

  return (
    <section className="space-y-2">
      <h4 className="font-medium text-[var(--text-secondary)] text-sm">
        2. Select {getOperatorSectionHeading(machine, isAdtMachine)} operator
      </h4>
      <div className="flex gap-2">
        <select
          aria-label="Operator"
          value={selectedOperatorId}
          disabled={
            !machine || isSubmitting || isLoadingOperators || eligibleOperators.length === 0
          }
          onChange={(event) => onSelectOperator(event.target.value)}
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] disabled:opacity-50"
        >
          <option value="">{placeholder}</option>
          {eligibleOperators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.name} · {operator.jobTitle}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAssign}
          disabled={!machine || isSubmitting || !selectedOperatorId}
          className="min-h-12 shrink-0 rounded-lg bg-[var(--accent-blue)] px-4 font-medium text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </section>
  );
}

function ScannerFeedback({
  error,
  assignment,
}: {
  error: string | null;
  assignment: Assignment | null;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-[var(--accent-red)] text-sm">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {assignment && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 p-3 text-[var(--text-heading)] text-sm"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--accent-green)]" />
          <span>
            {assignment.alreadyAssigned ? 'Already assigned: ' : 'Assigned: '}
            {assignment.operator.name} → {assignment.machine.name}. Medical clearance and induction
            are current. The operator was selected from the cleared personnel list.
            {getAssignmentCapabilityNote(assignment.machine)}
          </span>
        </div>
      )}
    </>
  );
}

export function C66MachineOperatorScanner({
  departmentId,
  machines,
  sites,
}: {
  departmentId: string;
  machines: ControlRoomMachine[];
  sites: ControlRoomSite[];
}) {
  const router = useRouter();
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? '');
  const [machine, setMachine] = useState<MachinePreview | null>(null);
  const [eligibleOperators, setEligibleOperators] = useState<EligibleOperator[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);

  async function loadOperators(machineId: string) {
    setIsLoadingOperators(true);
    setEligibleOperators([]);
    setSelectedOperatorId('');
    setError(null);
    try {
      const query = new URLSearchParams({ departmentId, machineId });
      const response = await fetch(`/api/control-room/machine-operator-scan?${query}`);
      if (!response.ok) {
        setError(await parseScanErrorResponse(response));
        return;
      }
      const parsed = machineOperatorScanResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.stage !== 'operators') {
        setError('The operator service returned an invalid response.');
        return;
      }
      setMachine(parsed.data.machine);
      setEligibleOperators(parsed.data.operators);
    } catch {
      setError('Connection lost while loading operators. Please retry the selection.');
    } finally {
      setIsLoadingOperators(false);
    }
  }

  function onSelectMachine(machineId: string) {
    setError(null);
    setAssignment(null);
    setSelectedMachineId(machineId);
    setSelectedOperatorId('');
    setEligibleOperators([]);

    const found = machineId ? machines.find((item) => item.id === machineId) : undefined;
    if (!found) {
      setMachine(null);
      return;
    }

    setMachine({
      id: found.id,
      name: found.name,
      machineType: found.machine_type,
      siteId: found.site_id,
      requiresHourlyLoads: isAdtOrDumpTruck(found.machine_type),
    });
    setSelectedSiteId(found.site_id || (sites[0]?.id ?? ''));
    void loadOperators(found.id);
  }

  async function assignOperator() {
    if (!machine || !selectedOperatorId) return;
    setError(null);
    setAssignment(null);
    const request = machineOperatorScanRequestSchema.safeParse({
      departmentId,
      machineId: machine.id,
      operatorId: selectedOperatorId,
      siteId: selectedSiteId || undefined,
    });
    if (!request.success) {
      setError('Select an eligible operator.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/control-room/machine-operator-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.data),
      });
      if (!response.ok) {
        setError(await parseScanErrorResponse(response));
        return;
      }
      const parsed = machineOperatorScanResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.stage !== 'assignment') {
        setError('The assignment service returned an invalid response.');
        return;
      }
      setAssignment(parsed.data);
      router.refresh();
    } catch {
      setError('Connection lost before the assignment could be confirmed. Retry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetSelection() {
    setMachine(null);
    setEligibleOperators([]);
    setAssignment(null);
    setSelectedMachineId('');
    setSelectedOperatorId('');
    setError(null);
  }

  const isAdtMachine = Boolean(machine && isAdtOrDumpTruck(machine.machineType));

  return (
    <GlassCard className="space-y-4">
      <ScannerHeader
        showReset={Boolean(machine || assignment)}
        isSubmitting={isSubmitting}
        onReset={resetSelection}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <MachineSelector
          machines={machines}
          selectedMachineId={selectedMachineId}
          isSubmitting={isSubmitting}
          onSelectMachine={onSelectMachine}
        />

        <OperatorSelector
          machine={machine}
          isAdtMachine={isAdtMachine}
          selectedOperatorId={selectedOperatorId}
          eligibleOperators={eligibleOperators}
          isLoadingOperators={isLoadingOperators}
          isSubmitting={isSubmitting}
          onSelectOperator={setSelectedOperatorId}
          onAssign={() => void assignOperator()}
        />
      </div>

      <ScannerFeedback error={error} assignment={assignment} />
    </GlassCard>
  );
}
