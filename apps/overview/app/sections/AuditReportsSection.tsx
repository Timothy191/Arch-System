"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  ClipboardList,
  History,
  RefreshCw,
  CheckCircle2,
  Lock,
  Palette,
} from "lucide-react";

interface AuditLogMeta {
  id: string;
  logNumber: number;
  folderName: string;
  folderDate: string;
  isoDate: string;
  displayDate: string;
  score: number;
  overallStatus: "PASS" | "WARN" | "FAIL";
  criticalCount: number;
  warningCount: number;
}

interface AuditData {
  manifest: AuditLogMeta[];
  activeLogId: string;
  results: string;
  requiredActions: string;
  designReport: string;
  rlsReport: string;
}

function SimpleMarkdownRenderer({ content }: { content: string }) {
  if (!content) return <p className="text-[var(--text-secondary)]">No content available.</p>;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = (keyPrefix: string) => {
    if (inTable && tableRows.length > 0) {
      elements.push(
        <div
          key={`${keyPrefix}-table`}
          className="my-4 overflow-x-auto rounded-lg border border-[var(--border-subtle)] shadow-card"
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-heading)] text-xs font-semibold uppercase tracking-wider border-b border-[var(--border-subtle)]">
              <tr>
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-4 py-3">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-white/60">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[var(--bg-secondary)]/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-4 py-2.5 text-[var(--text-secondary)] font-mono text-xs"
                    >
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("|")) {
      const parts = trimmed.split("|").slice(1, -1);
      if (trimmed.includes("---")) {
        return;
      }
      if (!inTable) {
        inTable = true;
        tableHeader = parts;
      } else {
        tableRows.push(parts);
      }
      return;
    } else {
      flushTable(`line-${idx}`);
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={idx}
          className="text-2xl font-bold text-[var(--text-heading)] mt-6 mb-3 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2"
        >
          {trimmed.slice(2)}
        </h1>,
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={idx}
          className="text-lg font-semibold text-[var(--text-heading)] mt-5 mb-2 flex items-center gap-2"
        >
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={idx} className="text-md font-medium text-[var(--text-secondary)] mt-4 mb-1">
          {trimmed.slice(4)}
        </h3>,
      );
    } else if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
      const isChecked = trimmed.startsWith("- [x]");
      const text = trimmed.slice(6);
      elements.push(
        <div
          key={idx}
          className="flex items-start gap-2.5 my-1.5 p-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm"
        >
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-0.5 rounded border-[var(--border-subtle)] text-[var(--accent-blue)] focus:ring-[var(--accent-blue)]"
          />
          <span
            className={
              isChecked
                ? "line-through text-[var(--text-muted)]"
                : "text-[var(--text-heading)] font-medium"
            }
          >
            {text}
          </span>
        </div>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={idx} className="ml-5 list-disc text-sm text-[var(--text-secondary)] my-1">
          {trimmed.slice(2)}
        </li>,
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={idx} className="text-sm text-[var(--text-secondary)] leading-relaxed my-2">
          {trimmed}
        </p>,
      );
    }
  });

  flushTable("end");

  return <div className="space-y-1">{elements}</div>;
}

export default function AuditReportsSection() {
  const [data, setData] = useState<AuditData | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string>("latest");
  const [activeTab, setActiveTab] = useState<"results" | "actions" | "design" | "rls">("results");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAuditData = async (logId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?log=${logId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Ignored for zero-console-warning lint rule
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData(selectedLogId);
  }, [selectedLogId]);

  const activeMeta =
    data?.manifest?.find((m) => m.id === selectedLogId || m.folderName === selectedLogId) ||
    data?.manifest?.[0];

  return (
    <div className="space-y-6">
      {/* Top Header & Log Selector Bar */}
      <div className="p-6 rounded-xl bg-white/70 border border-[var(--border-subtle)] shadow-card backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-accent-blue/10 text-[var(--accent-blue)] border border-accent-blue/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-heading)] flex items-center gap-2">
                Automated Audit & Compliance System
                {activeMeta && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {activeMeta.folderName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Versioned security, PostgreSQL RLS policies, and OKLCH design system validation
                reports
              </p>
            </div>
          </div>

          {/* Log selector dropdown */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
              <History className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Audit History:</span>
              <select
                value={selectedLogId}
                onChange={(e) => setSelectedLogId(e.target.value)}
                className="bg-transparent text-[var(--text-heading)] font-mono text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="latest">Latest Audit (.audit/latest)</option>
                {data?.manifest
                  ?.filter(
                    (log, index, self) =>
                      self.findIndex(
                        (item) => (item.folderName || item.id) === (log.folderName || log.id),
                      ) === index,
                  )
                  .map((log, idx) => (
                    <option key={`${log.id}-${log.isoDate || idx}`} value={log.folderName}>
                      {log.folderName} — Score: {log.score}% ({log.overallStatus})
                    </option>
                  ))}
              </select>
            </div>

            <button
              onClick={() => fetchAuditData(selectedLogId)}
              className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] transition-colors"
              title="Refresh Audit Data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-[var(--accent-blue)]" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Score metrics strip */}
        {activeMeta && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[var(--border-subtle)]">
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block">Overall Score</span>
              <span className="text-lg font-bold text-[var(--text-heading)] font-mono">
                {activeMeta.score.toFixed(1)}%
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block">Gate Status</span>
              <span
                className={`text-sm font-semibold inline-flex items-center gap-1.5 ${
                  activeMeta.overallStatus === "PASS"
                    ? "text-accent-green"
                    : activeMeta.overallStatus === "WARN"
                      ? "text-accent-amber"
                      : "text-accent-red"
                }`}
              >
                {activeMeta.overallStatus === "PASS" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {activeMeta.overallStatus}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block">Critical Violations</span>
              <span
                className={`text-lg font-bold font-mono ${activeMeta.criticalCount > 0 ? "text-accent-red" : "text-[var(--text-heading)]"}`}
              >
                {activeMeta.criticalCount}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block">Audit Timestamp</span>
              <span className="text-xs font-mono text-[var(--text-secondary)] block truncate mt-1">
                {activeMeta.displayDate}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation for 4 Markdown Reports */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-2">
        <button
          onClick={() => setActiveTab("results")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "results"
              ? "bg-[var(--accent-blue)] text-white shadow-sm"
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Results Summary</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 font-mono">results.md</span>
        </button>

        <button
          onClick={() => setActiveTab("actions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "actions"
              ? "bg-[var(--accent-blue)] text-white shadow-sm"
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Required Actions</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 font-mono">
            required-actions.md
          </span>
        </button>

        <button
          onClick={() => setActiveTab("design")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "design"
              ? "bg-[var(--accent-blue)] text-white shadow-sm"
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Design Audit</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 font-mono">
            design-report.md
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rls")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "rls"
              ? "bg-[var(--accent-blue)] text-white shadow-sm"
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>RLS Security Audit</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 font-mono">rls-report.md</span>
        </button>
      </div>

      {/* Report Content Panel */}
      <div className="p-6 rounded-xl bg-white/70 border border-[var(--border-subtle)] shadow-card backdrop-blur-xl min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-blue)]" />
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Loading audit report contents...
            </span>
          </div>
        ) : (
          <div className="prose max-w-none">
            {activeTab === "results" && <SimpleMarkdownRenderer content={data?.results || ""} />}
            {activeTab === "actions" && (
              <SimpleMarkdownRenderer content={data?.requiredActions || ""} />
            )}
            {activeTab === "design" && (
              <SimpleMarkdownRenderer content={data?.designReport || ""} />
            )}
            {activeTab === "rls" && <SimpleMarkdownRenderer content={data?.rlsReport || ""} />}
          </div>
        )}
      </div>
    </div>
  );
}
