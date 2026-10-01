'use client';

import { MachineTimeAllocationInput, machineLedgerCloseoutSchema } from '@repo/contract';
import { useOfflineQueue, usePitConnectivity } from '@repo/shared/hooks';
import { GlassCard } from '@repo/ui/components/GlassCard';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ZodError } from 'zod';

// Mock data: In reality, this would be fetched from the DB (the closing SMRs of the previous shift)
const MOCK_FLEET: MachineTimeAllocationInput[] = [
  {
    machine_id: 'd9b9365c-6e6b-4cf7-8b5d-e21b0b411d51',
    machine_name: 'DMP-01 (Drill)',
    opening_smr: 12450.5,
    closing_smr: 12450.5,
    breakdown_hours: 0,
    delay_hours: 0,
  },
  {
    machine_id: 'e1a2f1ab-1b1a-4c1c-9a1d-2b3a4b5c6d7e',
    machine_name: 'EXC-04 (Excavator)',
    opening_smr: 8900.0,
    closing_smr: 8900.0,
    breakdown_hours: 0,
    delay_hours: 0,
  },
  {
    machine_id: 'f2b3c2bc-2c2b-5d2d-0b2e-3c4b5c6d7e8f',
    machine_name: 'TRK-12 (Dumper)',
    opening_smr: 15600.2,
    closing_smr: 15600.2,
    breakdown_hours: 0,
    delay_hours: 0,
  },
];

export function ShiftCloseoutForm({ deptId, shiftDate }: { deptId: string; shiftDate: string }) {
  const { isOnline } = usePitConnectivity();
  const { enqueue, queue, isSyncing } = useOfflineQueue();

  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [machines, setMachines] = useState<MachineTimeAllocationInput[]>(MOCK_FLEET);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateMachine = (id: string, field: keyof MachineTimeAllocationInput, value: number) => {
    setMachines((prev) => prev.map((m) => (m.machine_id === id ? { ...m, [field]: value } : m)));
    // Clear error for this machine when edited
    if (validationErrors[id]) {
      setValidationErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[id];
        return newErrs;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    const payload = {
      shift_date: shiftDate,
      shift_type: shiftType,
      allocations: machines,
    };

    // 1. Zod Validation (The Block)
    try {
      machineLedgerCloseoutSchema.parse(payload);
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((issue) => {
          // Find which machine index failed
          const match = issue.path[1];
          if (typeof match === 'number') {
            const machineId = machines[match]?.machine_id;
            if (machineId) errors[machineId] = issue.message;
          }
        });
        setValidationErrors(errors);
        toast.error(
          'Shift closeout blocked. Please resolve SMR allocation errors highlighted in red.'
        );
      }
      return; // HARD BLOCK
    }

    setIsSubmitting(true);

    // 2. Industrial Standard: Enqueue mutation for offline resilience
    enqueue({
      url: '/api/control-room/shift-closeout',
      method: 'POST',
      body: JSON.stringify(payload),
      description: `Shift Closeout for ${shiftDate} (${shiftType})`,
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
    });

    toast.success(
      isOnline
        ? 'Shift closeout submitted and locked.'
        : 'Offline mode: Closeout saved to local queue.'
    );
    setIsSubmitting(false);
  };

  return (
    <GlassCard variant="spotlight" className="p-6 max-w-5xl bg-[#ffffff]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-color-text-primary">
            Shift Production & SMR Ledger
          </h2>
          <p className="text-sm text-color-text-secondary mt-1">
            Every machine must be accounted for. Operating SMR + Breakdowns + Delays cannot exceed
            12 hours.
          </p>
        </div>
        {!isOnline && (
          <span className="text-sm text-amber-600 animate-pulse font-medium px-3 py-1 bg-amber-50 rounded-full border border-amber-200">
            ⚠️ Connection Degraded
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-4 mb-4">
          <select
            value={shiftType}
            onChange={(e) => setShiftType(e.target.value as 'day' | 'night')}
            className="rounded border border-gray-300 p-2 text-sm bg-white"
          >
            <option value="day">Day Shift (06:00 - 18:00)</option>
            <option value="night">Night Shift (18:00 - 06:00)</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Equipment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opening SMR
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Closing SMR
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Breakdown (h)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delays (h)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Allocated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {machines.map((m) => {
                const isError = !!validationErrors[m.machine_id];
                const operatingHours = m.closing_smr - m.opening_smr;
                const totalAllocated = operatingHours + m.breakdown_hours + m.delay_hours;

                return (
                  <tr key={m.machine_id} className={isError ? 'bg-red-50' : ''}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {m.machine_name}
                      {isError && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs whitespace-normal">
                          {validationErrors[m.machine_id]}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {m.opening_smr.toFixed(1)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.1"
                        value={m.closing_smr}
                        onChange={(e) =>
                          updateMachine(
                            m.machine_id,
                            'closing_smr',
                            parseFloat(e.target.value) || m.opening_smr
                          )
                        }
                        className={`w-24 rounded border p-1 text-sm ${isError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={m.breakdown_hours}
                        onChange={(e) =>
                          updateMachine(
                            m.machine_id,
                            'breakdown_hours',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={`w-20 rounded border p-1 text-sm ${isError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={m.delay_hours}
                        onChange={(e) =>
                          updateMachine(
                            m.machine_id,
                            'delay_hours',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={`w-20 rounded border p-1 text-sm ${isError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span
                        className={
                          totalAllocated > 12
                            ? 'text-red-600 font-bold'
                            : totalAllocated < 12
                              ? 'text-amber-600'
                              : 'text-green-600'
                        }
                      >
                        {totalAllocated.toFixed(1)} / 12.0 h
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 font-medium">
            {queue.length > 0
              ? `${queue.length} shift record(s) buffered offline.`
              : 'Real-time sync active.'}
          </p>
          <button
            type="submit"
            disabled={isSubmitting || isSyncing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-sm disabled:opacity-50 transition-colors"
          >
            {isOnline ? 'Lock Shift & Compile Ledger' : 'Lock Shift (Local Cache)'}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
