"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Wrench,
  AlertTriangle,
  Info,
  Clock,
  CalendarDays,
  Save,
  Trash2,
  Sparkles,
} from "lucide-react";
import { bookOutBreakdown, directCheckout } from "./actions";
import { MACHINE_TYPES, type Breakdown } from "./types";

interface BookOutFormProps {
  departmentId: string;
  activeBreakdowns: Breakdown[];
}

const COMMON_REPAIRS = [
  "Hydraulic hose replaced & pressure tested",
  "Coolant system flushed & thermostat replaced",
  "Electrical wiring re-pinned & sensor calibrated",
  "Track links greased, aligned & tension adjusted",
  "Brake pads replaced & fluid bled",
  "Filter elements changed & fluid topped up",
  "Cylinder seal kit installed & cycle tested",
];

const DRAFT_BOOKOUT_KEY = "arch_breakdown_bookout_draft";

export function BookOutForm({ departmentId, activeBreakdowns }: BookOutFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [directMode, setDirectMode] = useState(false);

  // Normal book-out state
  const [selectedId, setSelectedId] = useState("");
  const [dateOut, setDateOut] = useState(new Date().toISOString().split("T")[0] ?? "");
  const [timeOut, setTimeOut] = useState(new Date().toTimeString().slice(0, 5));
  const [repairNotes, setRepairNotes] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  // Direct checkout state
  const [direct, setDirect] = useState({
    fleet_id: "",
    machine_type: "",
    reason: "",
    repair_notes: "",
    date_out: new Date().toISOString().split("T")[0] ?? "",
    time_out: new Date().toTimeString().slice(0, 5),
  });

  // Restore draft cache on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_BOOKOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedId) setSelectedId(parsed.selectedId);
        if (parsed.dateOut) setDateOut(parsed.dateOut);
        if (parsed.timeOut) setTimeOut(parsed.timeOut);
        if (parsed.repairNotes) setRepairNotes(parsed.repairNotes);
        setHasDraft(true);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  // Auto-persist draft cache
  useEffect(() => {
    if (selectedId || repairNotes) {
      try {
        localStorage.setItem(
          DRAFT_BOOKOUT_KEY,
          JSON.stringify({ selectedId, dateOut, timeOut, repairNotes }),
        );
        setHasDraft(true);
      } catch {
        // Storage fail-safe
      }
    }
  }, [selectedId, dateOut, timeOut, repairNotes]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_BOOKOUT_KEY);
    } catch {
      // Storage fail-safe
    }
    setSelectedId("");
    setDateOut(new Date().toISOString().split("T")[0] ?? "");
    setTimeOut(new Date().toTimeString().slice(0, 5));
    setRepairNotes("");
    setHasDraft(false);
  };

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
        clearDraft();
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-medium text-[var(--text-heading)]">Book Out Machine</h3>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">
            Complete repair and return machine to service.
          </p>
        </div>

        {hasDraft && !directMode && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
              <Save className="w-3 h-3" />
              Draft Cached
            </span>
            <button
              type="button"
              onClick={clearDraft}
              title="Clear Draft"
              className="p-1 rounded text-[var(--text-muted)] hover:text-accent-red hover:bg-accent-red/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
              Direct checkout (no prior book-in)
            </span>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Use when a machine was repaired and returned to service without being booked in first.
              Will be flagged in audit reports.
            </p>
          </div>
        </label>
      </div>

      {/* Mode A: Normal Book-Out */}
      {!directMode && (
        <form
          onSubmit={handleNormalSubmit}
          className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] p-6 space-y-4 shadow-card"
        >
          {activeBreakdowns.length === 0 ? (
            <div className="p-6 text-center text-[var(--text-secondary)] text-sm">
              <Info className="w-5 h-5 mx-auto mb-2 text-violet-400" />
              No active breakdowns to book out. Use &ldquo;Direct checkout&rdquo; above if needed.
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="breakdown-select"
                  className="block text-sm text-[var(--text-secondary)] mb-1.5"
                >
                  Select Machine in Workshop
                </label>
                <select
                  id="breakdown-select"
                  required
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
                >
                  <option value="">— Choose a broken-down machine —</option>
                  {activeBreakdowns.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fleet_id} — {b.machine_name || b.fleet_id} ({b.machine_type}) — in since{" "}
                      {b.date_in} {b.time_in}
                    </option>
                  ))}
                </select>
              </div>

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
                      {selectedBreakdown.machine_name || selectedBreakdown.fleet_id}
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
                    <p className="text-sm text-[var(--text-heading)]">{selectedBreakdown.reason}</p>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm text-[var(--text-secondary)]">
                    Repair / Service Notes
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    Quick presets
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_REPAIRS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRepairNotes((prev) => (prev ? `${prev}; ${r}` : r))}
                      className="px-2 py-1 text-[11px] rounded-md bg-[var(--bg-primary)] hover:bg-violet-500/10 hover:border-violet-500/30 border border-[var(--border-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all"
                    >
                      + {r}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="Describe repair actions performed..."
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
              >
                <Wrench className="w-4 h-4" />
                {isPending ? "Booking Out..." : "Complete Repair & Book Out"}
              </button>
            </>
          )}
        </form>
      )}

      {/* Mode B: Direct Checkout */}
      {directMode && (
        <form
          onSubmit={handleDirectSubmit}
          className="rounded-xl border border-amber-500/20 bg-[var(--bg-tertiary)] p-6 space-y-4 shadow-card"
        >
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              This will create a closed breakdown marked as &ldquo;missing book-in&rdquo; for audit
              integrity.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="direct-fleet-id"
                className="block text-sm text-[var(--text-secondary)] mb-1.5"
              >
                Fleet ID
              </label>
              <input
                id="direct-fleet-id"
                type="text"
                required
                placeholder="e.g. EX01, DT05"
                value={direct.fleet_id}
                onChange={(e) => setDirect({ ...direct, fleet_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="direct-machine-type"
                className="block text-sm text-[var(--text-secondary)] mb-1.5"
              >
                Machine Type
              </label>
              <select
                id="direct-machine-type"
                required
                value={direct.machine_type}
                onChange={(e) => setDirect({ ...direct, machine_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              >
                <option value="">— Select Type —</option>
                {MACHINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="direct-reason"
              className="block text-sm text-[var(--text-secondary)] mb-1.5"
            >
              Breakdown Reason
            </label>
            <input
              id="direct-reason"
              type="text"
              required
              placeholder="What was broken?"
              value={direct.reason}
              onChange={(e) => setDirect({ ...direct, reason: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Date Out
              </label>
              <input
                type="date"
                required
                aria-label="Direct Date Out"
                value={direct.date_out}
                onChange={(e) => setDirect({ ...direct, date_out: e.target.value })}
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
                aria-label="Direct Time Out"
                value={direct.time_out}
                onChange={(e) => setDirect({ ...direct, time_out: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="direct-notes"
              className="block text-sm text-[var(--text-secondary)] mb-1.5"
            >
              Repair Notes
            </label>
            <textarea
              id="direct-notes"
              rows={3}
              placeholder="What repair was completed?"
              value={direct.repair_notes}
              onChange={(e) => setDirect({ ...direct, repair_notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
          >
            <Wrench className="w-4 h-4" />
            {isPending ? "Recording Checkout..." : "Record Direct Checkout"}
          </button>
        </form>
      )}
    </div>
  );
}
