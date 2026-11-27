'use client';

/* cspell:ignore Tyre */

import { cn } from '@repo/ui/lib/utils';
import { AlertTriangle, ArrowUpDown, Plus, Wrench } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateTireRepairStatus } from './actions';
import {
  parseTireActivityNote,
  type TireMachineOption,
  type TireRecord,
  type TireRepairStatusOption,
} from './tire-constants';

export interface TireRepairRow {
  readonly id: string;
  readonly tireId: string;
  readonly machineId: string;
  readonly serialNumber: string;
  readonly dateOut: string;
  readonly dateIn: string;
  readonly reason: string;
  readonly comment: string;
  readonly status: TireRepairStatusOption;
  readonly serviceProvider: string;
}

type RepairSortKey =
  | 'machineId'
  | 'serialNumber'
  | 'dateOut'
  | 'dateIn'
  | 'status'
  | 'serviceProvider';

interface TiresInRepairTableProps {
  readonly tires: readonly TireRecord[];
  readonly machines?: readonly TireMachineOption[];
  readonly searchQuery: string;
  readonly density: 'comfortable' | 'compact';
}

const TH_CLASS =
  'px-4 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider whitespace-nowrap';
const INPUT_CELL_CLASS =
  'w-full min-w-[120px] rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-xs text-[var(--text-heading)] focus:border-[var(--accent-gold)] focus:outline-none';
const SORT_BTN_CLASS =
  'inline-flex items-center gap-1 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider hover:text-[var(--text-heading)]';
const PRIMARY_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-gold)]/60 bg-[var(--accent-gold)]/15 px-3 py-1.5 font-semibold text-xs text-[var(--text-heading)] transition-colors hover:bg-[var(--accent-gold)]/25';

const REPAIR_STATUS_LABELS: Readonly<Record<TireRepairStatusOption, string>> = {
  scrap: 'Scrap',
  repaired: 'Repaired',
  in_stock: 'In Stock',
};

function mapStoredStatusToRepairOption(
  storedStatus: string,
  parsedStatus?: string
): TireRepairStatusOption {
  if (parsedStatus === 'scrap' || storedStatus === 'scrapped') return 'scrap';
  if (parsedStatus === 'repaired') return 'repaired';
  if (parsedStatus === 'in_stock') return 'in_stock';
  return 'repaired';
}

export function deriveInitialRepairRows(tires: readonly TireRecord[]): TireRepairRow[] {
  const rows: TireRepairRow[] = [];
  for (const tire of tires) {
    const notes = tire.latestInspection?.notes ?? '';
    const parsed = parseTireActivityNote(notes);
    const isRepairEntry =
      notes.includes('[REPAIR]') ||
      notes.includes('TyreOff: Repair') ||
      (parsed.get('TyreOff') ?? '').toLowerCase().includes('repair') ||
      (tire.scrapped_reason ?? '').toLowerCase().includes('repair');

    if (!isRepairEntry) continue;

    const dateOut = parsed.get('DateOut') ?? tire.removed_at ?? tire.installed_at ?? '';
    const dateIn = parsed.get('DateIn') ?? '';
    const reason = parsed.get('Reason') ?? tire.scrapped_reason ?? 'Workshop Repair';
    const comment = parsed.get('Comment') ?? '';
    const serviceProvider = parsed.get('ServiceProvider') ?? '';
    const status = mapStoredStatusToRepairOption(tire.status, parsed.get('RepairStatus'));

    rows.push({
      id: tire.id,
      tireId: tire.id,
      machineId: parsed.get('Machine') ?? tire.machineName ?? 'Unassigned',
      serialNumber: tire.serial_number,
      dateOut,
      dateIn,
      reason,
      comment,
      status,
      serviceProvider,
    });
  }
  return rows;
}

export function TiresInRepairTable({
  tires,
  machines = [],
  searchQuery,
  density,
}: TiresInRepairTableProps) {
  const [rows, setRows] = useState<TireRepairRow[]>(() => deriveInitialRepairRows(tires));
  const [statusFilter, setStatusFilter] = useState<'all' | TireRepairStatusOption>('all');
  const [sortKey, setSortKey] = useState<RepairSortKey>('dateOut');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [draftMachineId, setDraftMachineId] = useState(machines[0]?.name ?? '');
  const [draftSerial, setDraftSerial] = useState('');
  const [draftDateOut, setDraftDateOut] = useState('');
  const [draftDateIn, setDraftDateIn] = useState('');
  const [draftReason, setDraftReason] = useState('');
  const [draftComment, setDraftComment] = useState('');
  const [draftStatus, setDraftStatus] = useState<TireRepairStatusOption>('repaired');
  const [draftProvider, setDraftProvider] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const cellPadClass = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';

  const handleSort = (key: RepairSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getAriaSort = (key: RepairSortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const persistRowUpdate = (previousRow: TireRepairRow, nextRow: TireRepairRow) => {
    if (nextRow.dateIn && nextRow.dateOut && nextRow.dateIn < nextRow.dateOut) {
      setRowErrors((prev) => ({
        ...prev,
        [nextRow.id]: 'Date in cannot be earlier than Date out.',
      }));
      return;
    }

    setRowErrors((prev) => {
      const copy = { ...prev };
      delete copy[nextRow.id];
      return copy;
    });

    setRows((prev) => prev.map((row) => (row.id === nextRow.id ? nextRow : row)));

    const matchingTire = tires.find((t) => t.id === nextRow.tireId);
    if (!matchingTire || !nextRow.dateOut || !nextRow.reason.trim()) {
      return;
    }

    startTransition(async () => {
      try {
        await updateTireRepairStatus({
          tireId: nextRow.tireId,
          machineId: nextRow.machineId,
          serialNumber: nextRow.serialNumber,
          dateOut: nextRow.dateOut,
          dateIn: nextRow.dateIn,
          reason: nextRow.reason,
          comment: nextRow.comment,
          status: nextRow.status,
          serviceProvider: nextRow.serviceProvider,
        });
        toast.success(`Updated repair status for ${nextRow.serialNumber}.`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to save repair update. Reverting change.';
        setRows((prev) => prev.map((row) => (row.id === previousRow.id ? previousRow : row)));
        setRowErrors((prev) => ({ ...prev, [nextRow.id]: message }));
        toast.error(message);
      }
    });
  };

  const handleAddRepairEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftError(null);

    if (!draftSerial.trim()) {
      setDraftError('Serial Number is required.');
      return;
    }
    if (!draftDateOut) {
      setDraftError('Date out is required.');
      return;
    }
    if (draftDateIn && draftDateIn < draftDateOut) {
      setDraftError('Date in cannot be earlier than Date out.');
      return;
    }
    if (draftReason.trim().length < 2) {
      setDraftError('Reason is required (min 2 characters).');
      return;
    }

    const matchedTire = tires.find(
      (t) => t.serial_number.toLowerCase() === draftSerial.trim().toLowerCase()
    );
    const newRow: TireRepairRow = {
      id: matchedTire?.id ?? `repair-${Date.now()}`,
      tireId: matchedTire?.id ?? '',
      machineId: draftMachineId.trim() || 'Unassigned',
      serialNumber: draftSerial.trim(),
      dateOut: draftDateOut,
      dateIn: draftDateIn,
      reason: draftReason.trim(),
      comment: draftComment.trim(),
      status: draftStatus,
      serviceProvider: draftProvider.trim(),
    };

    setRows((prev) => [newRow, ...prev]);
    setDraftSerial('');
    setDraftDateOut('');
    setDraftDateIn('');
    setDraftReason('');
    setDraftComment('');
    setDraftProvider('');
    setShowAddForm(false);

    if (matchedTire) {
      startTransition(async () => {
        try {
          await updateTireRepairStatus({
            tireId: matchedTire.id,
            machineId: newRow.machineId,
            serialNumber: newRow.serialNumber,
            dateOut: newRow.dateOut,
            dateIn: newRow.dateIn,
            reason: newRow.reason,
            comment: newRow.comment,
            status: newRow.status,
            serviceProvider: newRow.serviceProvider,
          });
          toast.success(`Logged repair entry for ${newRow.serialNumber}.`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to persist repair entry.';
          setRowErrors((prev) => ({ ...prev, [newRow.id]: message }));
        }
      });
    }
  };

  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!query) return true;
      const hay =
        `${row.machineId} ${row.serialNumber} ${row.reason} ${row.comment} ${row.serviceProvider} ${REPAIR_STATUS_LABELS[row.status]}`.toLowerCase();
      return hay.includes(query);
    });

    return [...filtered].sort((left, right) => {
      const a = left[sortKey] ?? '';
      const b = right[sortKey] ?? '';
      const cmp = String(a).localeCompare(String(b));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [rows, searchQuery, sortDirection, sortKey, statusFilter]);

  const activeErrorMessages = Object.values(rowErrors);

  return (
    <div className="space-y-3" data-testid="tires-in-repair-view">
      <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
            Repair Status:
          </span>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'repaired', label: 'Repaired' },
              { id: 'in_stock', label: 'In Stock' },
              { id: 'scrap', label: 'Scrap' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={cn(
                'rounded-md border px-2.5 py-1 font-medium text-xs transition-colors',
                statusFilter === opt.id
                  ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--text-heading)]'
                  : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--accent-gold)]/45'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          data-testid="toggle-add-repair-btn"
          className={PRIMARY_BTN_CLASS}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{showAddForm ? 'Close Form' : 'Add Repair Entry'}</span>
        </button>
      </div>

      {activeErrorMessages.length > 0 && (
        <div
          role="alert"
          className="mx-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{activeErrorMessages[0]}</span>
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddRepairEntry}
          className="mx-5 grid grid-cols-1 gap-3 rounded-xl border border-[var(--accent-gold)]/40 bg-white/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {draftError && (
            <div
              role="alert"
              className="col-span-full flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{draftError}</span>
            </div>
          )}
          <input
            type="text"
            aria-label="New repair Machine Id"
            placeholder="Machine Id (e.g. DT-01)"
            value={draftMachineId}
            onChange={(e) => setDraftMachineId(e.target.value)}
            className={INPUT_CELL_CLASS}
          />
          <input
            type="text"
            aria-label="New repair Serial Number"
            placeholder="Serial Number *"
            value={draftSerial}
            onChange={(e) => setDraftSerial(e.target.value)}
            className={INPUT_CELL_CLASS}
          />
          <input
            type="date"
            aria-label="New repair Date out"
            value={draftDateOut}
            onChange={(e) => setDraftDateOut(e.target.value)}
            className={INPUT_CELL_CLASS}
          />
          <input
            type="date"
            aria-label="New repair Date in"
            value={draftDateIn}
            onChange={(e) => setDraftDateIn(e.target.value)}
            className={INPUT_CELL_CLASS}
          />
          <input
            type="text"
            aria-label="New repair Reason"
            placeholder="Reason *"
            value={draftReason}
            onChange={(e) => setDraftReason(e.target.value)}
            className={INPUT_CELL_CLASS}
          />
          <input
            type="text"
            aria-label="New repair Comment"
            placeholder="Comment"
            value={draftComment}
            onChange={(e) => setDraftComment(e.target.value)}
            className={INPUT_CELL_CLASS}
          />
          <select
            aria-label="New repair Status"
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value as TireRepairStatusOption)}
            className={INPUT_CELL_CLASS}
          >
            <option value="scrap">Scrap</option>
            <option value="repaired">Repaired</option>
            <option value="in_stock">In Stock</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="New repair Service provider"
              placeholder="Service provider"
              value={draftProvider}
              onChange={(e) => setDraftProvider(e.target.value)}
              className={INPUT_CELL_CLASS}
            />
            <button type="submit" disabled={isPending} className={PRIMARY_BTN_CLASS}>
              Save
            </button>
          </div>
        </form>
      )}

      {visibleRows.length === 0 ? (
        <div className="space-y-2 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-accent-gold opacity-80" aria-hidden="true" />
          <p className="font-medium text-[var(--text-heading)] text-sm">No Tyres Out for Repair</p>
          <p className="mx-auto max-w-md text-[var(--text-muted)] text-xs">
            Log a tyre removal marked for Repair above or click Add Repair Entry to track vendor
            turnaround.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[980px] text-left text-sm"
            aria-label="Out for Repair table"
          >
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-black/[0.02]">
                <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('machineId')}>
                  <button
                    type="button"
                    onClick={() => handleSort('machineId')}
                    className={SORT_BTN_CLASS}
                  >
                    <span>Machine Id</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('serialNumber')}>
                  <button
                    type="button"
                    onClick={() => handleSort('serialNumber')}
                    className={SORT_BTN_CLASS}
                  >
                    <span>Serial Number</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('dateOut')}>
                  <button
                    type="button"
                    onClick={() => handleSort('dateOut')}
                    className={SORT_BTN_CLASS}
                  >
                    <span>Date out</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('dateIn')}>
                  <button
                    type="button"
                    onClick={() => handleSort('dateIn')}
                    className={SORT_BTN_CLASS}
                  >
                    <span>Date in</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className={TH_CLASS}>
                  Reason
                </th>
                <th scope="col" className={TH_CLASS}>
                  Comment
                </th>
                <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('status')}>
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className={SORT_BTN_CLASS}
                  >
                    <span>Status</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className={TH_CLASS} aria-sort={getAriaSort('serviceProvider')}>
                  <button
                    type="button"
                    onClick={() => handleSort('serviceProvider')}
                    className={SORT_BTN_CLASS}
                  >
                    <span>Service provider</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {visibleRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-white/60">
                  <td
                    className={cn(
                      cellPadClass,
                      'font-mono font-semibold text-[var(--text-heading)] text-xs'
                    )}
                  >
                    {row.machineId}
                  </td>
                  <td
                    className={cn(
                      cellPadClass,
                      'font-mono font-semibold text-[var(--text-heading)] text-xs'
                    )}
                  >
                    {row.serialNumber}
                  </td>
                  <td className={cn(cellPadClass, 'text-xs')}>
                    <input
                      type="date"
                      aria-label={`Date out for ${row.serialNumber}`}
                      value={row.dateOut}
                      onChange={(e) => persistRowUpdate(row, { ...row, dateOut: e.target.value })}
                      className={INPUT_CELL_CLASS}
                    />
                  </td>
                  <td className={cn(cellPadClass, 'text-xs')}>
                    <input
                      type="date"
                      aria-label={`Date in for ${row.serialNumber}`}
                      value={row.dateIn}
                      onChange={(e) => persistRowUpdate(row, { ...row, dateIn: e.target.value })}
                      className={INPUT_CELL_CLASS}
                    />
                  </td>
                  <td className={cn(cellPadClass, 'text-[var(--text-secondary)] text-xs')}>
                    {row.reason}
                  </td>
                  <td className={cn(cellPadClass, 'text-xs')}>
                    <input
                      type="text"
                      aria-label={`Comment for ${row.serialNumber}`}
                      placeholder="Add workshop comment..."
                      value={row.comment}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((item) =>
                            item.id === row.id ? { ...item, comment: e.target.value } : item
                          )
                        )
                      }
                      onBlur={(e) => persistRowUpdate(row, { ...row, comment: e.target.value })}
                      className={INPUT_CELL_CLASS}
                    />
                  </td>
                  <td className={cn(cellPadClass, 'text-xs')}>
                    <select
                      aria-label={`Repair status for ${row.serialNumber}`}
                      value={row.status}
                      disabled={isPending}
                      onChange={(e) =>
                        persistRowUpdate(row, {
                          ...row,
                          status: e.target.value as TireRepairStatusOption,
                        })
                      }
                      className={INPUT_CELL_CLASS}
                    >
                      <option value="scrap">Scrap</option>
                      <option value="repaired">Repaired</option>
                      <option value="in_stock">In Stock</option>
                    </select>
                  </td>
                  <td className={cn(cellPadClass, 'text-xs')}>
                    <input
                      type="text"
                      aria-label={`Service provider for ${row.serialNumber}`}
                      placeholder="Vendor name..."
                      value={row.serviceProvider}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((item) =>
                            item.id === row.id ? { ...item, serviceProvider: e.target.value } : item
                          )
                        )
                      }
                      onBlur={(e) =>
                        persistRowUpdate(row, { ...row, serviceProvider: e.target.value })
                      }
                      className={INPUT_CELL_CLASS}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
