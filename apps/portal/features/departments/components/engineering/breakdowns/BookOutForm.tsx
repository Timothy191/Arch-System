"use client";

import { useState, useTransition } from "react";
import { Wrench, AlertTriangle, Info, Clock, CalendarDays } from "lucide-react";
import { bookOutBreakdown, directCheckout } from "./actions";
import { MACHINE_TYPES, type Breakdown } from "./types";

interface BookOutFormProps {
  departmentId: string;
  activeBreakdowns: Breakdown[];
}

export function BookOutForm({
  departmentId,
  activeBreakdowns,
}: BookOutFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [directMode, setDirectMode] = useState(false);

  // Normal book-out state
  const [selectedId, setSelectedId] = useState("");
  const [dateOut, setDateOut] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );
  const [timeOut, setTimeOut] = useState(new Date().toTimeString().slice(0, 5));
  const [repairNotes, setRepairNotes] = useState("");

  // Direct checkout state
  const [direct, setDirect] = useState({
    fleet_id: "",
    machine_type: "",
    reason: "",
    repair_notes: "",
    date_out: new Date().toISOString().split("T")[0] ?? "",
    time_out: new Date().toTimeString().slice(0, 5),
  });

  const selectedBreakdown = activeBreakdowns.find((b) => b.id === selectedId);

  const handleNormalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedId) {
      setMessage({ type: "error", text: "Please select a machine" });
      return;
    }

    startTransition(async () => {
      try {
        await bookOutBreakdown(selectedId, {
          date_out: dateOut,
          time_out: timeOut,
          repair_notes: repairNotes || undefined,
        });
        setMessage({
          type: "success",
          text: "Machine booked out successfully!",
        });
        setSelectedId("");
        setRepairNotes("");
      } catch {
        setMessage({ type: "error", text: "Failed to book out." });
      }
    });
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!direct.fleet_id.trim()) {
      setMessage({ type: "error", text: "Fleet ID is required" });
      return;
    }
    if (!direct.machine_type) {
      setMessage({ type: "error", text: "Machine type is required" });
      return;
    }
    if (!direct.reason.trim()) {
      setMessage({ type: "error", text: "Breakdown reason is required" });
      return;
    }

    startTransition(async () => {
      try {
        await directCheckout(departmentId, {
          fleet_id: direct.fleet_id,
          machine_type: direct.machine_type,
          reason: direct.reason,
          repair_notes: direct.repair_notes || undefined,
          date_out: direct.date_out,
          time_out: direct.time_out,
        });
        setMessage({
          type: "success",
          text: "Direct checkout recorded — flagged as missing book-in.",
        });
        setDirect({
          fleet_id: "",
          machine_type: "",
          reason: "",
          repair_notes: "",
          date_out: new Date().toISOString().split("T")[0] ?? "",
          time_out: new Date().toTimeString().slice(0, 5),
        });
      } catch {
        setMessage({
          type: "error",
          text: "Failed to record direct checkout.",
        });
      }
    });
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-lg font-medium text-[var(--text-heading)]">
          Book Out Machine
        </h3>
        <p className="text-[var(--text-secondary)] text-sm mt-0.5">
          Complete repair and return machine to service.
        </p>
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

      {/* Toggle */}
      <div className="mb-5 rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] px-4 py-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={directMode}
            onChange={(e) => {
              setDirectMode(e.target.checked);
              setMessage(null);
            }}
            className="accent-violet-500"
          />
          <div>
            <span className="text-sm font-medium text-[var(--text-heading)]">
              Machine was never booked in
            </span>
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">
              Record will be flagged as{" "}
              <span className="text-accent-blue font-medium">
                Missing Book-In
              </span>{" "}
              in all reports.
            </p>
          </div>
        </label>
      </div>

      {!directMode ? (
        /* Normal Book Out */
        <div className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] p-6">
          <form onSubmit={handleNormalSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="breakdown-select"
                className="block text-sm text-[var(--text-secondary)] mb-1.5"
              >
                Select Machine (Active / Pending)
              </label>
              <select
                id="breakdown-select"
                required
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              >
                <option value="">— Select a booked-in machine —</option>
                {activeBreakdowns.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fleet_id} — {b.machine_name || b.fleet_id} (Pending since{" "}
                    {b.date_in})
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-filled Breakdown Details */}
            {selectedBreakdown && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                    Fleet ID
                  </p>
                  <p className="text-sm text-[var(--text-heading)] font-medium">
                    {selectedBreakdown.fleet_id}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                    Machine Name
                  </p>
                  <p className="text-sm text-[var(--text-heading)] font-medium">
                    {selectedBreakdown.machine_name ||
                      selectedBreakdown.fleet_id}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                    Machine Type
                  </p>
                  <p className="text-sm text-[var(--text-heading)] font-medium">
                    {selectedBreakdown.machine_type}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                    Date In
                  </p>
                  <p className="text-sm text-[var(--text-heading)] font-medium">
                    {selectedBreakdown.date_in} {selectedBreakdown.time_in}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                    Reason
                  </p>
                  <p className="text-sm text-[var(--text-heading)]">
                    {selectedBreakdown.reason}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Date Out
                </label>
                <input
                  type="date"
                  required
                  aria-label="Date Out"
                  value={dateOut}
                  onChange={(e) => setDateOut(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Time Out
                </label>
                <input
                  type="time"
                  required
                  aria-label="Time Out"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Repair / Service Notes
              </label>
              <textarea
                rows={3}
                placeholder="What was fixed?"
                value={repairNotes}
                onChange={(e) => setRepairNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wrench className="w-4 h-4" />
              {isPending ? "Completing..." : "Complete Service"}
            </button>
          </form>
        </div>
      ) : (
        /* Direct Checkout */
        <div className="rounded-xl border border-accent-blue/20 bg-[var(--bg-tertiary)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-accent-blue" />
            <h4 className="text-accent-blue font-medium">
              Direct Checkout — Missing Book-In
            </h4>
          </div>

          <div className="mb-4 px-3 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs">
            <strong>Audit Notice:</strong> This record will be flagged as
            "Missing Book-In" in all reports.
          </div>

          <form onSubmit={handleDirectSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Fleet ID
              </label>
              <input
                required
                placeholder="e.g. FL-123"
                value={direct.fleet_id}
                onChange={(e) =>
                  setDirect({ ...direct, fleet_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Machine Type
              </label>
              <select
                required
                value={direct.machine_type}
                onChange={(e) =>
                  setDirect({ ...direct, machine_type: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
              >
                <option value="">Select Type</option>
                {MACHINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Breakdown Reason / Fault
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe the fault that was repaired..."
                value={direct.reason}
                onChange={(e) =>
                  setDirect({ ...direct, reason: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                  Date Out
                </label>
                <input
                  type="date"
                  required
                  value={direct.date_out}
                  onChange={(e) =>
                    setDirect({ ...direct, date_out: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                  Time Out
                </label>
                <input
                  type="time"
                  required
                  value={direct.time_out}
                  onChange={(e) =>
                    setDirect({ ...direct, time_out: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Repair Notes (optional)
              </label>
              <textarea
                rows={3}
                placeholder="What was done?"
                value={direct.repair_notes}
                onChange={(e) =>
                  setDirect({ ...direct, repair_notes: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent-blue hover:bg-[var(--accent-electric-blue)] text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle className="w-4 h-4" />
              {isPending ? "Recording..." : "Record Direct Checkout"}
            </button>
          </form>

          <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
            <Info className="w-4 h-4 text-accent-blue mt-0.5 shrink-0" />
            <p className="text-[var(--text-secondary)] text-xs">
              Book-in date/time will be recorded as same as book-out since it is
              unknown. Duration will show as{" "}
              <strong className="text-[#ccc]">0h 0m</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
