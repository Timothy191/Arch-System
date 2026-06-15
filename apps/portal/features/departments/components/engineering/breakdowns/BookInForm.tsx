"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ClipboardPlus,
  ClipboardList,
  Clock,
  CalendarDays,
} from "lucide-react";
import { createBreakdown } from "./actions";
import type { Breakdown, Machine } from "./types";

interface BookInFormProps {
  departmentId: string;
  activeBreakdowns: Breakdown[];
  machines: Machine[];
}

export function BookInForm({
  departmentId,
  activeBreakdowns,
  machines,
}: BookInFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [dateIn, setDateIn] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );
  const [timeIn, setTimeIn] = useState(new Date().toTimeString().slice(0, 5));
  const [reason, setReason] = useState("");

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineId),
    [machines, selectedMachineId],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedMachine) {
      setMessage({ type: "error", text: "Please select a machine" });
      return;
    }
    if (!reason.trim() || reason.length < 5) {
      setMessage({
        type: "error",
        text: "Reason must be at least 5 characters",
      });
      return;
    }

    startTransition(async () => {
      try {
        await createBreakdown(departmentId, {
          fleet_id: selectedMachine.serial_number || selectedMachine.id,
          machine_name: selectedMachine.name,
          machine_type: selectedMachine.machine_type,
          date_in: dateIn,
          time_in: timeIn,
          reason,
        });
        setMessage({
          type: "success",
          text: "Machine booked in successfully!",
        });

        // Trigger n8n workflow for breakdown alert
        import("@repo/utils").then(({ triggerWorkflow }) => {
          triggerWorkflow("machine-breakdown", {
            department_id: departmentId,
            fleet_id: selectedMachine.serial_number || selectedMachine.id,
            machine_type: selectedMachine.machine_type,
            reason,
            status: "active",
          });
        });

        setSelectedMachineId("");
        setDateIn(new Date().toISOString().split("T")[0] ?? "");
        setTimeIn(new Date().toTimeString().slice(0, 5));
        setReason("");
      } catch (err) {
        setMessage({ type: "error", text: "Failed to book in machine." });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] p-6">
        <div className="flex items-center gap-3 mb-5">
          <ClipboardPlus className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-medium text-[var(--text-heading)]">
            Book In Machine
          </h3>
        </div>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg border text-sm ${
              message.type === "success"
                ? "bg-accent-green/10 border-accent-green/20 text-accent-green"
                : "bg-accent-red/10 border-accent-red/20 text-accent-red"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Machine Selector */}
          <div>
            <label
              htmlFor="machine-select"
              className="block text-sm text-[var(--text-secondary)] mb-1.5"
            >
              Select Machine
            </label>
            <select
              id="machine-select"
              required
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
            >
              <option value="">— Choose a machine —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                </option>
              ))}
            </select>
          </div>

          {/* Auto-filled Machine Details */}
          {selectedMachine && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                  Fleet / Serial
                </p>
                <p className="text-sm text-[var(--text-heading)] font-medium">
                  {selectedMachine.serial_number ||
                    selectedMachine.id.slice(0, 8)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                  Machine Type
                </p>
                <p className="text-sm text-[var(--text-heading)] font-medium">
                  {selectedMachine.machine_type}
                </p>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Date In
              </label>
              <input
                type="date"
                required
                aria-label="Date In"
                value={dateIn}
                onChange={(e) => setDateIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-1.5">
                <Clock className="w-3.5 h-3.5" />
                Time In
              </label>
              <input
                type="time"
                required
                aria-label="Time In"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
              Breakdown Reason
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Booking In..." : "Book In Machine"}
          </button>
        </form>
      </div>

      {/* Active List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-400" />
            <h3 className="text-lg font-medium text-[var(--text-heading)]">
              Active Breakdowns
            </h3>
          </div>
          <span className="text-[var(--text-secondary)] text-sm">
            {activeBreakdowns.length} machines
          </span>
        </div>

        <div className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] overflow-hidden">
          {activeBreakdowns.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
              No active breakdowns. All machines operational.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-emphasis)]">
                    <th
                      scope="col"
                      className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                    >
                      Fleet ID
                    </th>
                    <th
                      scope="col"
                      className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                    >
                      Machine
                    </th>
                    <th
                      scope="col"
                      className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                    >
                      Date In
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeBreakdowns.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--border-emphasis)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[var(--text-heading)] font-medium">
                        {b.fleet_id}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-heading)]">
                        {b.machine_name || b.fleet_id}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {b.machine_type}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                        {b.date_in}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
