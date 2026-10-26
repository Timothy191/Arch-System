'use client';

import { BarChart3, Coins, Terminal } from 'lucide-react';
import { type AgentTaskLog, PROJECT_MILESTONES } from './agentic-monitor-data';

export function AgenticMonitorSpendAndFeed({
  selectedAgent,
  filteredFeed,
}: {
  selectedAgent: string;
  filteredFeed: AgentTaskLog[];
}) {
  return (
    <>
      {/* CLAUDE CODE PRICING & TOKEN ECONOMIC CALCULATIONS MATRIX */}
      <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-sm">
        <div className="flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-[#f59e0b]" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Claude Code &amp; Anthropic Token Pricing Rate Card (ZAR Conversion @ R18.52/USD)
            </h3>
          </div>
          <span className="font-mono text-emerald-700 text-xs">Anthropic Tier 4 Rates</span>
        </div>

        <div className="grid grid-cols-1 gap-4 font-mono text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3.5">
            <div className="text-[11px] text-[var(--text-muted)]">Standard Input Tokens</div>
            <div className="mt-1 font-bold text-[var(--text-heading)] text-base">
              R 55.56 <span className="text-[10px] text-[var(--text-muted)]">/ 1M</span>
            </div>
            <div className="mt-1 text-[#38bdf8] text-[10px]">$3.00 USD / 1M tokens</div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3.5">
            <div className="text-[11px] text-[var(--text-muted)]">Prompt Cache Write</div>
            <div className="mt-1 font-bold text-[var(--text-heading)] text-base">
              R 69.45 <span className="text-[10px] text-[var(--text-muted)]">/ 1M</span>
            </div>
            <div className="mt-1 text-[#f59e0b] text-[10px]">$3.75 USD / 1M tokens (5m TTL)</div>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-[var(--bg-secondary)] bg-emerald-500/5 p-3.5">
            <div className="font-semibold text-[11px] text-emerald-700">
              Prompt Cache Read (90% Off)
            </div>
            <div className="mt-1 font-bold text-base text-emerald-700">
              R 5.56 <span className="text-[10px] text-[var(--text-muted)]">/ 1M</span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-700">
              $0.30 USD / 1M tokens (90% Savings)
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3.5">
            <div className="text-[11px] text-[var(--text-muted)]">Output Generation</div>
            <div className="mt-1 font-bold text-[var(--text-heading)] text-base">
              R 277.80 <span className="text-[10px] text-[var(--text-muted)]">/ 1M</span>
            </div>
            <div className="mt-1 text-[#f43f5e] text-[10px]">$15.00 USD / 1M tokens</div>
          </div>
        </div>
      </div>

      {/* VISUAL HISTOGRAM: Weekly Spend & Token Volume Trajectory */}
      <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-2 border-[var(--border-subtle)] border-b pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-700" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Weekly Project Expenditure &amp; Token Volume Graph (Day 1 – Today)
            </h3>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            Total Incurred: <strong className="text-emerald-700">R 4,825.60 ZAR</strong> (~$260.56
            USD)
          </span>
        </div>

        {/* Visual Bar Chart Graph */}
        <div className="pt-4 pb-2">
          <div className="grid h-44 grid-cols-5 items-end gap-3 border-[var(--border-subtle)] border-b px-2 pb-2 sm:gap-6">
            {PROJECT_MILESTONES.map((m, idx) => {
              const maxZar = 1300;
              const heightPct = Math.round((m.zarCost / maxZar) * 100);
              return (
                <div
                  key={idx}
                  className="group flex h-full flex-col items-center justify-end gap-2"
                >
                  <div className="font-mono font-semibold text-[10px] text-emerald-700 transition-transform group-hover:scale-110">
                    R {m.zarCost.toFixed(0)}
                  </div>
                  <div className="relative flex h-32 w-full max-w-[50px] flex-col justify-end overflow-hidden rounded-t-lg bg-[var(--bg-secondary)]">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500 group-hover:brightness-125"
                    />
                  </div>
                  <div className="text-center">
                    <div className="font-medium font-mono text-[11px] text-[var(--text-heading)]">
                      {m.period}
                    </div>
                    <div className="font-mono text-[9px] text-[var(--text-muted)]">
                      {m.tokensUsed} tok
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-[var(--border-subtle)] border-b font-mono text-[var(--text-muted)]">
                <th className="pb-3 font-medium">Period</th>
                <th className="pb-3 font-medium">Milestone / Scope</th>
                <th className="pb-3 text-right font-medium">Tokens Used</th>
                <th className="pb-3 text-right font-medium">Tokens Cached</th>
                <th className="pb-3 text-right font-medium">Cost (ZAR)</th>
                <th className="pb-3 text-right font-medium">Savings (ZAR)</th>
                <th className="pb-3 text-right font-medium">Commits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {PROJECT_MILESTONES.map((m, idx) => (
                <tr key={idx} className="transition-colors hover:bg-[var(--bg-secondary)]">
                  <td className="py-3 font-medium font-mono text-[var(--text-heading)]">
                    <div>{m.period}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{m.dateRange}</div>
                  </td>
                  <td className="py-3 pr-4 font-medium text-[var(--text-heading)]">
                    {m.milestone}
                  </td>
                  <td className="py-3 text-right font-mono text-[var(--text-secondary)]">
                    {m.tokensUsed}
                  </td>
                  <td className="py-3 text-right font-mono text-emerald-700">{m.tokensCached}</td>
                  <td className="py-3 text-right font-mono font-semibold text-[var(--text-heading)]">
                    R {m.zarCost.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-emerald-400">
                    +R {m.zarSaved.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-[var(--text-muted)]">
                    {m.commits}
                  </td>
                </tr>
              ))}
              {/* Total Summary Row */}
              <tr className="border-[var(--border-default)] border-t-2 bg-[var(--bg-secondary)]/60 font-semibold">
                <td className="py-3 font-mono text-emerald-700">TOTAL (9 Weeks)</td>
                <td className="py-3 text-[var(--text-heading)]">
                  Entire Project Lifecycle (Day 1 to Today)
                </td>
                <td className="py-3 text-right font-mono text-[var(--text-heading)]">18.42M</td>
                <td className="py-3 text-right font-mono text-emerald-700">54.80M</td>
                <td className="py-3 text-right font-mono text-emerald-700 text-sm">R 4,825.60</td>
                <td className="py-3 text-right font-mono text-emerald-400 text-sm">+R 14,280.00</td>
                <td className="py-3 text-right font-mono text-[var(--text-heading)]">77</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chronological Task Audit Feed */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-[var(--border-subtle)] border-b pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-700" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">
              Chronological Multi-Agent Pipeline Execution Feed
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[var(--text-muted)] text-xs">
              Filter: <strong className="text-emerald-700">{selectedAgent.toUpperCase()}</strong> (
              {filteredFeed.length} items)
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {filteredFeed.map((task) => (
            <div
              key={task.id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 transition-colors hover:border-emerald-600/40"
            >
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium font-mono text-[11px] text-emerald-700">
                    {task.id}
                  </span>
                  <span className="rounded border border-[#f59e0b]/20 bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[#f59e0b] text-[10px]">
                    {task.agent}
                  </span>
                  <span className="font-semibold text-[var(--text-heading)] text-xs">
                    {task.role}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    ({task.timestamp})
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-[var(--text-secondary)]">
                    {task.tokensUsed.toLocaleString()} tokens
                  </span>
                  <span className="font-semibold text-emerald-700">
                    R {task.zarCost.toFixed(2)}
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-[10px] text-emerald-700">
                    {task.status}
                  </span>
                </div>
              </div>

              <div className="mt-2 font-medium text-[var(--text-heading)] text-xs">
                {task.action}
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-relaxed">
                {task.details}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
