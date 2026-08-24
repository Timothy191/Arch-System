"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Sun, Moon, Lock, CheckCircle, Clock, Printer } from "lucide-react";

interface ShiftCompilationHeaderProps {
  departmentSlug: string;
  shiftDate: string;
  shiftType: "day" | "night";
  status: "open" | "closed";
  closedAt?: string | null;
  onOpenCloseoutModal: () => void;
}

export function ShiftCompilationHeader({
  departmentSlug,
  shiftDate,
  shiftType,
  status,
  closedAt,
  onOpenCloseoutModal,
}: ShiftCompilationHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateChange = (newDate: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("date", newDate);
    router.push(`/${departmentSlug}/shift-compilation?${params.toString()}`);
  };

  const handleShiftChange = (newShift: "day" | "night") => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("shift", newShift);
    router.push(`/${departmentSlug}/shift-compilation?${params.toString()}`);
  };

  const isClosed = status === "closed";

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border border-black/[0.08] bg-white/80 backdrop-blur-xl shadow-card">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Unified Shift Compilation
          </h1>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isClosed
                ? "bg-neutral-900 text-white"
                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            {isClosed ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            Shift {status}
          </span>
        </div>
        <p className="text-xs text-neutral-500">
          Consolidated operational overview: loads, SMU utilization, downtime, and tire health
          {isClosed && closedAt && (
            <span className="ml-1 text-neutral-400">
              • Locked on {new Date(closedAt).toLocaleString()}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {/* Date Selector */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-black/[0.08] bg-white text-xs font-medium text-neutral-800 shadow-sm">
          <Calendar className="h-4 w-4 text-neutral-500" />
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-transparent border-none outline-hidden text-neutral-900 font-mono text-xs cursor-pointer"
          />
        </div>

        {/* Shift Type Switcher */}
        <div className="flex items-center rounded-lg border border-black/[0.08] bg-neutral-100/80 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => handleShiftChange("day")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              shiftType === "day"
                ? "bg-white text-neutral-900 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            Day Shift
          </button>
          <button
            type="button"
            onClick={() => handleShiftChange("night")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              shiftType === "night"
                ? "bg-white text-neutral-900 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Moon className="h-3.5 w-3.5 text-indigo-500" />
            Night Shift
          </button>
        </div>

        {/* Lock & Closeout Action */}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.08] hover:bg-neutral-50 text-neutral-600 text-xs font-medium shadow-sm transition-all cursor-pointer no-print"
          title="Print Compliance Summary"
        >
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Print Summary</span>
        </button>

        {!isClosed ? (
          <button
            type="button"
            onClick={onOpenCloseoutModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer no-print"
          >
            <Lock className="h-3.5 w-3.5" />
            Lock & Sign Shift
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-medium border border-neutral-200">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            Shift Finalized
          </div>
        )}
      </div>
    </div>
  );
}
