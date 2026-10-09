import { GlassCard } from '@repo/ui/GlassCard';

export default function AdminLoading() {
  return (
    <div
      className="p-lg max-w-7xl mx-auto w-full space-y-6"
      aria-busy="true"
      aria-label="Loading admin panel"
    >
      {/* Admin Tabs Bar Skeleton */}
      <div className="w-full h-10 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-default)] p-1 flex items-center gap-1 overflow-x-auto">
        <div className="h-8 px-3 rounded-sm bg-[var(--bg-primary)] shadow-sm flex items-center gap-2 shrink-0">
          <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
          <div className="w-12 h-3.5 bg-[var(--bg-tertiary)] rounded animate-pulse" />
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
            className="h-8 px-3 rounded-sm flex items-center gap-2 opacity-60 shrink-0"
          >
            <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
            <div className="w-16 h-3.5 bg-[var(--bg-tertiary)] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Search and Action Bar Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md h-10 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md flex items-center px-3 gap-2">
          <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
          <div className="w-32 h-3.5 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-md bg-[var(--accent-emerald)]/40 animate-pulse" />
      </div>

      {/* Table Skeleton inside GlassCard */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Department
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Accessible Depts
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="hover:bg-[var(--bg-tertiary)]/50">
                  <td className="px-6 py-4">
                    <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-16 bg-[var(--bg-tertiary)] rounded-full animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-28 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <div className="w-8 h-8 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] animate-pulse" />
                      <div className="w-8 h-8 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] animate-pulse" />
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
