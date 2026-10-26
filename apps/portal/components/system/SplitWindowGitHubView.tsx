'use client';

import { cn } from '@repo/ui/lib/utils';
import { GitBranch } from 'lucide-react';
import { useState } from 'react';
import { GITHUB_COMMITS } from './split-window-data';

export function GitHubMockView() {
  const [tab, setTab] = useState<'code' | 'pulls' | 'issues'>('code');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-amber-500/20 border-b bg-amber-500/10 px-3 py-1.5 font-medium text-[11px] text-amber-800">
        <span>⚠️ Developer Preview — Simulated GitHub Integration</span>
        <span className="rounded bg-amber-200/60 px-1.5 py-0.5 font-bold font-mono text-[10px] uppercase">
          PROTOTYPE
        </span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-[13px]">
        {/* Branch & Status */}
        <div className="flex items-center justify-between rounded-xl border border-black/[0.05] bg-black/[0.02] p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="font-semibold text-[var(--text-heading)]">master</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-[var(--accent-green)]">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>CI Quality Gate Passed</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-black/[0.06] border-b font-semibold text-[12px] text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() => setTab('code')}
            className={cn(
              'border-b-2 px-3 pb-2 transition-all',
              tab === 'code'
                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                : 'border-transparent hover:text-[var(--text-secondary)]'
            )}
          >
            Commits
          </button>
          <button
            type="button"
            onClick={() => setTab('pulls')}
            className={cn(
              'border-b-2 px-3 pb-2 transition-all',
              tab === 'pulls'
                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                : 'border-transparent hover:text-[var(--text-secondary)]'
            )}
          >
            Pull Requests (1)
          </button>
          <button
            type="button"
            onClick={() => setTab('issues')}
            className={cn(
              'border-b-2 px-3 pb-2 transition-all',
              tab === 'issues'
                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                : 'border-transparent hover:text-[var(--text-secondary)]'
            )}
          >
            Issues (2)
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-3">
          {tab === 'code' && (
            <div className="space-y-2.5">
              <p className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                Recent Commits
              </p>
              {GITHUB_COMMITS.map((c) => (
                <div
                  key={c.hash}
                  className="flex flex-col gap-1 rounded-lg border border-black/[0.04] bg-black/[0.015] p-3 transition-colors hover:bg-black/[0.03]"
                >
                  <div className="flex items-center justify-between">
                    <span className="cursor-pointer font-semibold text-blue-600 hover:underline">
                      {c.hash}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">{c.date}</span>
                  </div>
                  <p className="text-[12px] text-[var(--text-heading)] leading-snug">{c.msg}</p>
                  <span className="text-[10px] text-[var(--text-muted)]">By {c.author}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'pulls' && (
            <div className="space-y-2 rounded-lg border border-black/[0.04] bg-black/[0.015] p-4">
              <div className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-green)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div>
                  <p className="font-bold text-[13px] text-[var(--text-heading)] leading-snug">
                    #105 Feature: Access Control Card Printing & 5-Entity QR RFID Generator
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Opened by Timothy • 13 unit tests passed
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'issues' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-black/[0.04] bg-black/[0.015] p-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="font-bold text-[var(--text-heading)] leading-snug">
                    #104 Magicard Neo 300 direct spooling & CUPS verification
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--text-muted)]">Resolved in #105</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
