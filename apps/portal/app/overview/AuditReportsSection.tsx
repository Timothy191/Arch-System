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
import { GlassCard } from "@repo/ui/GlassCard";

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
  if (!content) return <p className="text-arch-text-tertiary">No content available.</p>;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = (keyPrefix: string) => {
    if (inTable && tableRows.length > 0) {
      elements.push(
        <div key={`${keyPrefix}-table`} className="my-4 overflow-x-auto rounded-lg border border-arch-border-subtle shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-arch-surface-tertiary/70 text-arch-text-primary text-xs font-semibold uppercase tracking-wider border-b border-arch-border-subtle">
              <tr>
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-4 py-3">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-arch-border-subtle bg-white/60">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-arch-surface-secondary/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 text-arch-text-secondary font-mono text-xs">
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
        // Table separator row, ignore
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
        <h1 key={idx} className="text-2xl font-bold text-arch-text-primary mt-6 mb-3 flex items-center gap-2 border-b border-arch-border-subtle pb-2">
          {trimmed.slice(2)}
        </h1>,
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={idx} className="text-lg font-semibold text-arch-text-primary mt-5 mb-2 flex items-center gap-2">
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={idx} className="text-md font-medium text-arch-text-secondary mt-4 mb-1">
          {trimmed.slice(4)}
        </h3>,
      );
    } else if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
      const isChecked = trimmed.startsWith("- [x]");
      const text = trimmed.slice(6);
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 my-1.5 p-2 rounded-md bg-arch-surface-secondary/60 border border-arch-border-subtle text-sm">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-0.5 rounded border-arch-border-emphasis text-accent-blue focus:ring-accent-blue"
          />
          <span className={isChecked ? "line-through text-arch-text-tertiary" : "text-arch-text-primary font-medium"}>
            {text}
          </span>
        </div>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={idx} className="ml-5 list-disc text-sm text-arch-text-secondary my-1">
          {trimmed.slice(2)}
        </li>,
      );
    } else if (trimmed.startsWith("```")) {
      // Code block boundary handled simply
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={idx} className="text-sm text-arch-text-secondary leading-relaxed my-2">
          {trimmed}
        </p>
      );
    }
  });

  flushTable("end");

  return <div className="space-y-1">{elements}</div>;
}

export function AuditReportsSection() {
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

  const activeMeta = data?.manifest?.find((m) => m.id === selectedLogId || m.folderName === selectedLogId) || data?.manifest?.[0];

  return (
    <div className="space-y-6">
      {/* Top Header & Log Selector Bar */}
      <GlassCard variant="default" className="p-6 bg-white/70 border-arch-border-subtle shadow-card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-arch-text-primary flex items-center gap-2">
                Automated Audit & Compliance System
                {activeMeta && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-arch-surface-tertiary border border-arch-border-subtle text-arch-text-secondary">
                    {activeMeta.folderName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-arch-text-secondary mt-0.5">
                Versioned security, PostgreSQL RLS policies, and OKLCH design system validation reports
              </p>
            </div>
          </div>

          {/* Log selector dropdown */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-arch-surface-secondary border border-arch-border-subtle text-xs text-arch-text-secondary">
              <History className="w-4 h-4 text-arch-text-tertiary" />
              <span>Audit History:</span>
              <select
                value={selectedLogId}
                onChange={(e) => setSelectedLogId(e.target.value)}
                className="bg-transparent text-arch-text-primary font-mono text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="latest">Latest Audit (.audit/latest)</option>
                {data?.manifest
                  ?.filter((log, index, self) => self.findIndex((item) => (item.folderName || item.id) === (log.folderName || log.id)) === index)
                  .map((log, idx) => (
                    <option key={`${log.id}-${log.isoDate || idx}`} value={log.folderName}>
                      {log.folderName} — Score: {log.score}% ({log.overallStatus})
                    </option>
                  ))}
              </select>
            </div>

            <button
              onClick={() => fetchAuditData(selectedLogId)}
              className="p-2 rounded-lg bg-arch-surface-secondary border border-arch-border-subtle text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary transition-colors"
              title="Refresh Audit Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-accent-blue" : ""}`} />
            </button>
          </div>
        </div>

        {/* Score metrics strip */}
        {activeMeta && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-arch-border-subtle">
            <div className="p-3 rounded-lg bg-arch-surface-secondary/50 border border-arch-border-subtle">
              <span className="text-xs text-arch-text-tertiary block">Overall Score</span>
              <span className="text-lg font-bold text-arch-text-primary font-mono">
                {activeMeta.score.toFixed(1)}%
              </span>
            </div>
            <div className="p-3 rounded-lg bg-arch-surface-secondary/50 border border-arch-border-subtle">
              <span className="text-xs text-arch-text-tertiary block">Gate Status</span>
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
            <div className="p-3 rounded-lg bg-arch-surface-secondary/50 border border-arch-border-subtle">
              <span className="text-xs text-arch-text-tertiary block">Critical Violations</span>
              <span className={`text-lg font-bold font-mono ${activeMeta.criticalCount > 0 ? "text-accent-red" : "text-arch-text-primary"}`}>
                {activeMeta.criticalCount}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-arch-surface-secondary/50 border border-arch-border-subtle">
              <span className="text-xs text-arch-text-tertiary block">Audit Timestamp</span>
              <span className="text-xs font-mono text-arch-text-secondary block truncate mt-1">
                {activeMeta.displayDate}
              </span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Tab Navigation for 4 Markdown Reports */}
      <div className="flex flex-wrap gap-2 border-b border-arch-border-subtle pb-2">
        <button
          onClick={() => setActiveTab("results")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "results"
              ? "bg-accent-blue text-white shadow-sm"
              : "bg-arch-surface-secondary/80 text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary"
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
              ? "bg-accent-blue text-white shadow-sm"
              : "bg-arch-surface-secondary/80 text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Required Actions</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 font-mono">required-actions.md</span>
        </button>

        <button
          onClick={() => setActiveTab("design")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "design"
              ? "bg-accent-blue text-white shadow-sm"
              : "bg-arch-surface-secondary/80 text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Design Audit</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 font-mono">design-report.md</span>
        </button>

        <button
          onClick={() => setActiveTab("rls")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "rls"
              ? "bg-accent-blue text-white shadow-sm"
              : "bg-arch-surface-secondary/80 text-arch-text-secondary hover:text-arch-text-primary hover:bg-arch-surface-tertiary"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>RLS Security Audit</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 font-mono">rls-report.md</span>
        </button>
      </div>

      {/* Report Content Panel */}
      <GlassCard variant="default" className="p-6 bg-white/70 border-arch-border-subtle shadow-card min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-accent-blue" />
            <span className="text-xs text-arch-text-tertiary font-mono">Loading audit report contents...</span>
          </div>
        ) : (
          <div className="prose max-w-none">
            {activeTab === "results" && <SimpleMarkdownRenderer content={data?.results || ""} />}
            {activeTab === "actions" && <SimpleMarkdownRenderer content={data?.requiredActions || ""} />}
            {activeTab === "design" && <SimpleMarkdownRenderer content={data?.designReport || ""} />}
            {activeTab === "rls" && <SimpleMarkdownRenderer content={data?.rlsReport || ""} />}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
