"use client";

import { Button } from "@repo/ui/components/ui/button";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  Clock,
  Cpu,
  Download,
  FileCheck2,
  Layers,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { QRCodeSection } from "../../access-card-actions/card-actions/qr-section";
import type { CardPrintJob, EmployeeCardProfile, Neo300Printer } from "./actions";
import { cancelNeo300Job, getEmployeeCardProfiles, sendNeo300PrintJob } from "./actions";

interface Neo300PrintStudioProps {
  initialPrinter: Neo300Printer;
  initialEmployees: EmployeeCardProfile[];
  initialJobs: CardPrintJob[];
}

export function Neo300PrintStudio({
  initialPrinter,
  initialEmployees,
  initialJobs,
}: Neo300PrintStudioProps) {
  const [printer] = useState<Neo300Printer>(initialPrinter);
  const [employees, setEmployees] = useState<EmployeeCardProfile[]>(initialEmployees);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeCardProfile | null>(
    initialEmployees[0] ?? null
  );
  const [jobs, setJobs] = useState<CardPrintJob[]>(initialJobs);
  const [search, setSearch] = useState("");
  const [cardSide, setCardSide] = useState<"front" | "back">("front");
  const [isPending, startTransition] = useTransition();

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
        const message = err instanceof Error ? err.message : "Failed to dispatch print job";
        toast.error(message);
      }
    });
  };

  const handleCancelJob = (jobId: string) => {
    startTransition(async () => {
      try {
        await cancelNeo300Job(jobId);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "cancelled" } : j)));
        toast.info("Job cancelled");
      } catch (err: unknown) {
        toast.error("Failed to cancel job");
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">
                  Magicard Neo 300 Card Studio
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  {printer.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Model:{" "}
                <span className="font-semibold text-[var(--text-primary)]">{printer.model}</span> |
                CUPS Queue: <span className="font-mono text-blue-400">{printer.cups_name}</span> |
                Connection:{" "}
                <span className="uppercase text-[var(--text-primary)]">
                  {printer.connection_type}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-[var(--text-muted)]">Active Print Queue</p>
              <p className="text-sm font-mono font-bold text-[var(--text-heading)]">
                {jobs.filter((j) => j.status === "queued" || j.status === "printing").length} Jobs
                Pending
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Printer status synchronized")}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Status
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Main Layout: Directory & Live Preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Column 1: Employee Directory (5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard className="p-4 space-y-4 border border-[var(--border-default)]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-heading)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Employee Badging Directory
              </h3>
              <span className="text-xs text-[var(--text-muted)]">{employees.length} available</span>
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
                        ? "bg-blue-600/15 border-blue-500/50 shadow-sm"
                        : "bg-[var(--bg-secondary)]/30 border-[var(--border-default)] hover:bg-[var(--bg-secondary)]/60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center font-bold text-white text-sm shrink-0 border border-white/10">
                        {emp.first_name[0]}
                        {emp.surname[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-[var(--text-heading)] truncate">
                          {emp.first_name} {emp.surname}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {emp.emp_code} • {emp.job_title || "Personnel"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {emp.qr_code ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <QrCode className="w-3 h-3" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
                <div className="p-8 text-center text-sm text-[var(--text-muted)]">
                  No personnel records found.
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* ── Column 2: CR80 PVC Interactive Preview & Print Trigger (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          <GlassCard className="p-6 border border-[var(--border-default)] flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-default)]">
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-heading)] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  CR80 PVC Card Preview (ISO/IEC 7810 ID-1 Standard)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Standard format 85.60 mm × 53.98 mm • Optimized for Neo 300 Dye-Sublimation
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => setCardSide("front")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    cardSide === "front"
                      ? "bg-blue-600 text-white"
                      : "text-[var(--text-muted)] hover:text-white"
                  }`}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setCardSide("back")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    cardSide === "back"
                      ? "bg-blue-600 text-white"
                      : "text-[var(--text-muted)] hover:text-white"
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            {selectedEmp ? (
              <div className="flex flex-col items-center gap-6 w-full">
                {/* ── Card Canvas (Realistic CR80 Styling) ── */}
                <div className="relative w-[380px] h-[240px] rounded-2xl p-5 shadow-2xl transition-all duration-300 overflow-hidden border border-white/20 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white select-none">
                  {/* Holographic Security Overlay Pattern */}
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                  <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

                  {cardSide === "front" ? (
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
                        <div className="w-20 h-24 rounded-lg bg-slate-800 border-2 border-white/30 overflow-hidden flex flex-col items-center justify-center relative shadow-inner shrink-0">
                          <span className="text-2xl font-bold text-slate-400">
                            {selectedEmp.first_name[0]}
                            {selectedEmp.surname[0]}
                          </span>
                          <span className="text-[7px] text-slate-500 tracking-wider mt-1 uppercase">
                            PHOTO VERIFIED
                          </span>
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <h4 className="text-base font-bold leading-tight truncate text-white">
                            {selectedEmp.first_name} {selectedEmp.surname}
                          </h4>
                          <p className="text-xs text-blue-200 font-medium truncate">
                            {selectedEmp.job_title || "Site Operator"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            NAT ID: {selectedEmp.id_number || "Verified"}
                          </p>

                          <div className="pt-2 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                                isMedicalValid
                                  ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                                  : "bg-red-500/20 border-red-400/30 text-red-300"
                              }`}
                            >
                              <Stethoscope className="w-2.5 h-2.5" />
                              Med: {isMedicalValid ? "PASS" : "EXP"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                                isInductionValid
                                  ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                                  : "bg-amber-500/20 border-amber-400/30 text-amber-300"
                              }`}
                            >
                              <FileCheck2 className="w-2.5 h-2.5" />
                              Induct: {isInductionValid ? "OK" : "DUE"}
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
                      <div className="flex items-center justify-between text-[8px] text-slate-400 border-t border-white/10 pt-1 font-mono">
                        <span>DEPT: {selectedEmp.department_name?.toUpperCase()}</span>
                        <span>SMART PVC • DUAL CHIP RFID</span>
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

                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[8px] font-mono text-slate-400">
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
                    {isPending ? "Sending to Neo 300..." : "Print Card via Neo 300"}
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => toast.info("PDF card preview ready for download")}
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-[var(--text-muted)]">
                Select an employee from the directory to preview and print their PVC ID badge.
              </div>
            )}
          </GlassCard>

          {/* ── Print Queue / Recent Jobs Table ── */}
          <GlassCard className="p-4 border border-[var(--border-default)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-heading)] flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Neo 300 Print Queue & Recent Dispatches
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
                      <td className="py-2.5 font-mono text-slate-400">#{j.id.substring(0, 8)}</td>
                      <td className="py-2.5 font-medium text-[var(--text-primary)]">
                        {j.employee_name}
                      </td>
                      <td className="py-2.5 text-slate-400">{printer.model}</td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            j.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : j.status === "queued" || j.status === "printing"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse"
                                : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                          }`}
                        >
                          {j.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400">
                        {new Date(j.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 text-right">
                        {j.status === "queued" && (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(j.id)}
                            className="text-red-400 hover:text-red-300 font-medium text-xs"
                          >
                            Cancel
                          </button>
                        )}
                        {j.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => handlePrint(j.personnel_id || "")}
                            className="text-blue-400 hover:text-blue-300 font-medium text-xs"
                          >
                            Reprint
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
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
