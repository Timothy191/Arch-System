import { BorderBox } from '@repo/ui/BorderBox';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, Database, FileText, Server } from 'lucide-react';
import { connection } from 'next/server';

export default async function DatabaseDashboardPage() {
  await connection();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-[var(--text-heading)]">
          Database Operations Dashboard
        </h2>
        <p className="text-[var(--text-muted)] text-sm">
          {new Date().toLocaleDateString('en-ZA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <Divider variant="fading" label="DATABASE METRICS" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
              Schemas
            </p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">12</p>
          <p className="text-emerald-500 text-xs mt-1">All active</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent-blue)]" />
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
              Queries/s
            </p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">342</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-violet-500" />
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
              Active Connections
            </p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">48</p>
        </GlassCard>

        <BorderBox variant="patterned" padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--text-muted)]" />
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
                Migrations
              </p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-heading)] mt-2">178</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">Fully applied</p>
          </div>
        </BorderBox>
      </div>
    </div>
  );
}
