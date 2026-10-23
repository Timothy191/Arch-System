'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Lock,
  Palette,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface AuditLogMeta {
  id: string;
  logNumber: number;
  folderName: string;
  folderDate: string;
  isoDate: string;
  displayDate: string;
  score: number;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
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

  const lines = content.split('\n');
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
            <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)] font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
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
                <tr key={rIdx} className="transition-colors hover:bg-[var(--bg-secondary)]/40">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-4 py-2.5 font-mono text-[var(--text-secondary)] text-xs"
                    >
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('|')) {
      const parts = trimmed.split('|').slice(1, -1);
      if (trimmed.includes('---')) {
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

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={idx}
          className="mt-6 mb-3 flex items-center gap-2 border-[var(--border-subtle)] border-b pb-2 font-bold text-2xl text-[var(--text-heading)]"
        >
          {trimmed.slice(2)}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2
          key={idx}
          className="mt-5 mb-2 flex items-center gap-2 font-semibold text-[var(--text-heading)] text-lg"
        >
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={idx} className="mt-4 mb-1 font-medium text-[var(--text-secondary)] text-md">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      const isChecked = trimmed.startsWith('- [x]');
      const text = trimmed.slice(6);
      elements.push(
        <div
          key={idx}
          className="my-1.5 flex items-start gap-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2 text-sm"
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
                ? 'text-[var(--text-muted)] line-through'
                : 'font-medium text-[var(--text-heading)]'
            }
          >
            {text}
          </span>
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={idx} className="my-1 ml-5 list-disc text-[var(--text-secondary)] text-sm">
          {trimmed.slice(2)}
        </li>
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={idx} className="my-2 text-[var(--text-secondary)] text-sm leading-relaxed">
          {trimmed}
        </p>
      );
    }
  });

  flushTable('end');

  return <div className="space-y-1">{elements}</div>;
}

export default function AuditReportsSection() {
  const [data, setData] = useState<AuditData | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string>('latest');
  const [activeTab, setActiveTab] = useState<'results' | 'actions' | 'design' | 'rls'>('results');
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
  }, [selectedLogId, fetchAuditData]);

  const activeMeta =
    data?.manifest?.find((m) => m.id === selectedLogId || m.folderName === selectedLogId) ||
    data?.manifest?.[0];

  return (
    <div className="space-y-6">
      {/* Top Header & Log Selector Bar */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-white/70 p-6 shadow-card backdrop-blur-xl">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-3 text-[var(--accent-blue)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-xl">
                Automated Audit & Compliance System
                {activeMeta && (
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-0.5 font-mono font-semibold text-[var(--text-secondary)] text-xs">
                    {activeMeta.folderName}
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                Versioned security, PostgreSQL RLS policies, and OKLCH design system validation
                reports
              </p>
            </div>
          </div>

          {/* Log selector dropdown */}
          <div className="flex w-full items-center gap-3 md:w-auto">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[var(--text-secondary)] text-xs">
              <History className="h-4 w-4 text-[var(--text-muted)]" />
              <span>Audit History:</span>
              <select
                value={selectedLogId}
                onChange={(e) => setSelectedLogId(e.target.value)}
                className="cursor-pointer bg-transparent font-medium font-mono text-[var(--text-heading)] text-xs focus:outline-none"
              >
                <option value="latest">Latest Audit (.audit/latest)</option>
                {data?.manifest
                  ?.filter(
                    (log, index, self) =>
                      self.findIndex(
                        (item) => (item.folderName || item.id) === (log.folderName || log.id)
                      ) === index
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
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
              title="Refresh Audit Data"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin text-[var(--accent-blue)]' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Score metrics strip */}
        {activeMeta && (
          <div className="mt-6 grid grid-cols-2 gap-4 border-[var(--border-subtle)] border-t pt-5 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
              <span className="block text-[var(--text-muted)] text-xs">Overall Score</span>
              <span className="font-bold font-mono text-[var(--text-heading)] text-lg">
                {activeMeta.score.toFixed(1)}%
              </span>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
              <span className="block text-[var(--text-muted)] text-xs">Gate Status</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold text-sm ${
                  activeMeta.overallStatus === 'PASS'
                    ? 'text-accent-green'
                    : activeMeta.overallStatus === 'WARN'
                      ? 'text-accent-amber'
                      : 'text-accent-red'
                }`}
              >
                {activeMeta.overallStatus === 'PASS' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {activeMeta.overallStatus}
              </span>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
              <span className="block text-[var(--text-muted)] text-xs">Critical Violations</span>
              <span
                className={`font-bold font-mono text-lg ${activeMeta.criticalCount > 0 ? 'text-accent-red' : 'text-[var(--text-heading)]'}`}
              >
                {activeMeta.criticalCount}
              </span>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
              <span className="block text-[var(--text-muted)] text-xs">Audit Timestamp</span>
              <span className="mt-1 block truncate font-mono text-[var(--text-secondary)] text-xs">
                {activeMeta.displayDate}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation for 4 Markdown Reports */}
      <div className="flex flex-wrap gap-2 border-[var(--border-subtle)] border-b pb-2">
        <button
          onClick={() => setActiveTab('results')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all ${
            activeTab === 'results'
              ? 'bg-[var(--accent-blue)] text-white shadow-sm'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Results Summary</span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">results.md</span>
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all ${
            activeTab === 'actions'
              ? 'bg-[var(--accent-blue)] text-white shadow-sm'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Required Actions</span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">
            required-actions.md
          </span>
        </button>

        <button
          onClick={() => setActiveTab('design')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all ${
            activeTab === 'design'
              ? 'bg-[var(--accent-blue)] text-white shadow-sm'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <Palette className="h-4 w-4" />
          <span>Design Audit</span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">
            design-report.md
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rls')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all ${
            activeTab === 'rls'
              ? 'bg-[var(--accent-blue)] text-white shadow-sm'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>RLS Security Audit</span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">rls-report.md</span>
        </button>
      </div>

      {/* Report Content Panel */}
      <div className="min-h-[400px] rounded-xl border border-[var(--border-subtle)] bg-white/70 p-6 shadow-card backdrop-blur-xl">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
            <span className="font-mono text-[var(--text-muted)] text-xs">
              Loading audit report contents...
            </span>
          </div>
        ) : (
          <div className="prose max-w-none">
            {activeTab === 'results' && <SimpleMarkdownRenderer content={data?.results || ''} />}
            {activeTab === 'actions' && (
              <SimpleMarkdownRenderer content={data?.requiredActions || ''} />
            )}
            {activeTab === 'design' && (
              <SimpleMarkdownRenderer content={data?.designReport || ''} />
            )}
            {activeTab === 'rls' && <SimpleMarkdownRenderer content={data?.rlsReport || ''} />}
          </div>
        )}
      </div>
    </div>
  );
}
