"use client";

import { useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import type { Breakdown } from "./types";
import { useRouter } from "next/navigation";

interface BreakdownsTableProps {
  breakdowns: Breakdown[];
  showStatus: boolean;
}

export function BreakdownsTable({
  breakdowns,
  showStatus,
}: BreakdownsTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = breakdowns.filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.fleet_id.toLowerCase().includes(term) ||
      b.machine_type.toLowerCase().includes(term) ||
      b.reason.toLowerCase().includes(term)
    );
  });

  const calcDuration = (b: Breakdown): string => {
    if (!b.date_out || !b.time_out) return "—";
    const start = new Date(`${b.date_in}T${b.time_in}`);
    const end = new Date(`${b.date_out}T${b.time_out}`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return "0h 0m";
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showStatus && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              placeholder="Search Fleet ID, Machine Type or Reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm placeholder:text-[#555] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-tertiary)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
            No records found.
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
                    Date In
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                  >
                    Date Out
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                  >
                    Duration
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                  >
                    Reason
                  </th>
                  {showStatus && (
                    <th
                      scope="col"
                      className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                    >
                      Status
                    </th>
                  )}
                  <th
                    scope="col"
                    className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs uppercase tracking-wide font-medium"
                  >
                    Record
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-b border-[var(--border-emphasis)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors ${
                      b.missing_book_in ? "border-l-2 border-l-blue-500" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-violet-400 font-medium">
                      {b.fleet_id}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-heading)]">
                      {b.machine_name || b.fleet_id}
                    </td>
                    <td className="px-4 py-3 text-[#ccc]">{b.machine_type}</td>
                    <td className="px-4 py-3 text-[#ccc] whitespace-nowrap">
                      {b.date_in}
                    </td>
                    <td className="px-4 py-3 text-[#ccc] whitespace-nowrap">
                      {b.date_out || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {b.status === "completed" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-accent-green/10 border border-accent-green/20 text-accent-green">
                          {calcDuration(b)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#ccc] max-w-[200px] truncate">
                      {b.reason}
                    </td>
                    {showStatus && (
                      <td className="px-4 py-3">
                        {b.status === "completed" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-green bg-transparent border-transparent">
                            <span className="badge-pulse-dot" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-accent-blue/10 border border-accent-blue/20 text-accent-blue font-medium">
                            Pending
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {b.missing_book_in ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                          Missing Book-In
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)] text-xs">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count */}
      <div className="text-[var(--text-secondary)] text-xs">
        {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
      </div>
    </div>
  );
}
