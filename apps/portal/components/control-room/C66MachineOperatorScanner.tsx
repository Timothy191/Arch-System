'use client';

import {
  machineOperatorScanRequestSchema,
  machineOperatorScanResponseSchema,
  z,
} from '@repo/contract';
import { ContextCardTrigger } from '@repo/ui/components/ui/context-card';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, UserCheck } from 'lucide-react';
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

  async function readError(response: Response): Promise<string> {
    const body: unknown = await response.json();
    const parsed = scanErrorSchema.safeParse(body);
    if (!parsed.success) return 'The assignment request failed. Please try again.';
    if (parsed.data.code === 'SITE_REQUIRED') return 'Choose the machine site before assigning.';
    return parsed.data.error;
  }

  async function loadOperators(machineId: string, _currentMachine: ControlRoomMachine) {
    setIsLoadingOperators(true);
    setEligibleOperators([]);
    setSelectedOperatorId('');
    setError(null);
    try {
      const query = new URLSearchParams({ departmentId, machineId });
      const response = await fetch(`/api/control-room/machine-operator-scan?${query}`);
      if (!response.ok) {
        setError(await readError(response));
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

    if (!machineId) {
      setMachine(null);
      return;
    }

    const found = machines.find((item) => item.id === machineId);
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
    void loadOperators(found.id, found);
  }

  async function assignOperator(operatorIdToAssign?: string) {
    const targetOperatorId = operatorIdToAssign || selectedOperatorId;
    if (!machine || !targetOperatorId) return;
    setError(null);
    setAssignment(null);
    const request = machineOperatorScanRequestSchema.safeParse({
      departmentId,
      machineId: machine.id,
      operatorId: targetOperatorId,
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
        setError(await readError(response));
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <ContextCardTrigger
            side="bottom"
            align="center"
            delay={100}
            content={
              <>
                <h3 className="flex items-center gap-2 text-lg font-medium text-[var(--text-heading)]">
                  <UserCheck size={20} className="text-[var(--accent-blue)]" />
                  Machine &amp; Operator Assignment
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Select a machine to filter and assign qualified operators. When an ADT machine is
                  selected, operators are automatically filtered to show certified ADT operators
                  with current medical and induction clearances.
                </p>
              </>
            }
            render={<Info className="h-4 w-4 text-[var(--accent-blue)]" />}
          />
        </div>
        {(machine || assignment) && (
          <button
            type="button"
            onClick={resetSelection}
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)] disabled:opacity-50"
          >
            <RefreshCw size={15} />
            Reset
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2">
          <h4 className="text-sm font-medium text-[var(--text-secondary)]">1. Select a machine</h4>
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

        <section className="space-y-2">
          <h4 className="text-sm font-medium text-[var(--text-secondary)]">
            2. Select {isAdtMachine ? 'an ADT' : machine ? `a ${machine.machineType}` : 'a machine'}{' '}
            operator
          </h4>
          <div className="flex gap-2">
            <select
              aria-label="Operator"
              value={selectedOperatorId}
              disabled={
                !machine || isSubmitting || isLoadingOperators || eligibleOperators.length === 0
              }
              onChange={(event) => setSelectedOperatorId(event.target.value)}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] disabled:opacity-50"
            >
              <option value="">
                {!machine
                  ? 'Choose a machine first…'
                  : isLoadingOperators
                    ? 'Loading cleared operators…'
                    : eligibleOperators.length
                      ? isAdtMachine
                        ? 'Choose cleared ADT operator…'
                        : 'Choose cleared, matching operator…'
                      : isAdtMachine
                        ? 'No cleared ADT operators'
                        : 'No cleared type-matched operators'}
              </option>
              {eligibleOperators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name} · {operator.jobTitle}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void assignOperator()}
              disabled={!machine || isSubmitting || !selectedOperatorId}
              className="min-h-12 shrink-0 rounded-lg bg-[var(--accent-blue)] px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSubmitting ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </section>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-[var(--accent-red)]">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {assignment && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 p-3 text-sm text-[var(--text-heading)]"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--accent-green)]" />
          <span>
            {assignment.alreadyAssigned ? 'Already assigned: ' : 'Assigned: '}
            {assignment.operator.name} → {assignment.machine.name}. Medical clearance and induction
            are current. The operator was selected from the cleared personnel list.
            {(assignment.machine.machineCapabilities?.requiresHourlyLoads ??
            assignment.machine.requiresHourlyLoads)
              ? ' This machine is included automatically in Hourly Loads.'
              : assignment.machine.machineCapabilities?.tracksBenchClearance
                ? ' This machine tracks bench clearance and blade push metrics.'
                : ''}
          </span>
        </div>
      )}
    </GlassCard>
  );
}
