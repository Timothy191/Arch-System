import { GlassCard } from '@repo/ui/GlassCard';

export default function AdminLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 p-lg"
      aria-busy="true"
      aria-label="Loading admin panel"
    >
      {/* Admin Tabs Bar Skeleton */}
      <div className="flex h-10 w-full items-center gap-1 overflow-x-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1">
        <div className="flex h-8 shrink-0 items-center gap-2 rounded-sm bg-[var(--bg-primary)] px-3 shadow-sm">
          <div className="h-4 w-4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          <div className="h-3.5 w-12 animate-pulse rounded bg-[var(--bg-tertiary)]" />
        </div>
        {[
          'Departments',
          'Fleet',
          'Sites',
          'Integrations',
          'Webhooks',
          'Audit Logs',
          'Settings',
        ].map((tab) => (
          <div
            key={tab}
            className="flex h-8 shrink-0 items-center gap-2 rounded-sm px-3 opacity-60"
          >
            <div className="h-4 w-4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
            <div className="h-3.5 w-16 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          </div>
        ))}
      </div>

      {/* Search and Action Bar Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex h-10 max-w-md flex-1 items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3">
          <div className="h-4 w-4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          <div className="h-3.5 w-32 animate-pulse rounded bg-[var(--bg-tertiary)]" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-md bg-[var(--accent-emerald)]/40" />
      </div>

      {/* Table Skeleton inside GlassCard */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b">
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Department
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Accessible Depts
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="hover:bg-[var(--bg-tertiary)]/50">
                  <td className="px-6 py-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-tertiary)]" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--bg-tertiary)]" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-28 animate-pulse rounded bg-[var(--bg-tertiary)]" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-[var(--bg-tertiary)]" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <div className="h-8 w-8 animate-pulse rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
                      <div className="h-8 w-8 animate-pulse rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
