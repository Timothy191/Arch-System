import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { BorderBox } from '@repo/ui/BorderBox';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  ArrowRight,
  CircleDot,
  ClipboardList,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { getDepartmentContext } from '~/lib/dept-context';

interface BreakdownSummary {
  id: string;
  machine_name: string;
  reason: string;
  priority: string;
  created_at: string;
}

async function getEngineeringHubData(deptId: string) {
  const db = await createReadReplicaClient();

  const [{ count: activeBreakdowns }, { count: resolvedToday }, { data: recentBreakdowns }] =
    await Promise.all([
      db
        .from('breakdowns')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', deptId)
        .eq('status', 'active')
        .is('deleted_at', null),
      db
        .from('breakdowns')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', deptId)
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 86400000).toISOString()),
      db
        .from('breakdowns')
        .select('id, machine_name, reason, priority, created_at')
        .eq('department_id', deptId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

  return {
    activeBreakdowns: activeBreakdowns ?? 0,
    resolvedToday: resolvedToday ?? 0,
    recentBreakdowns: (recentBreakdowns ?? []) as BreakdownSummary[],
  };
}

export default async function EngineeringDashboardPage() {
  const { deptId } = await getDepartmentContext({
    department: 'engineering',
  });

  const { activeBreakdowns, resolvedToday, recentBreakdowns } = await getEngineeringHubData(deptId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-2xl text-[var(--text-heading)]">Engineering Hub</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Breakdowns, tire management &amp; maintenance overview
          </p>
        </div>
        <p className="text-[var(--text-muted)] text-sm">
          {new Date().toLocaleDateString('en-ZA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <Divider variant="dotted" label="FLEET HEALTH & TELEMETRY" />

      {/* Secondary Hub Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Breakdowns Card */}
        <Link href="/engineering/breakdowns" className="group h-full">
          <BorderBox variant="thick-transparent" className="h-full border-0 p-0">
            <GlassCard className="h-full cursor-pointer transition-colors hover:bg-[var(--bg-secondary)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-accent-red/10 p-2.5 text-accent-red">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-heading)] text-lg">Breakdowns</h3>
                    <p className="text-[var(--text-muted)] text-sm">
                      Active faults &amp; maintenance issues
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-[var(--text-muted)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent-blue)]" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-accent-red/10 bg-accent-red/5 p-3">
                  <p className="font-bold text-2xl text-accent-red">{activeBreakdowns}</p>
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">Active Breakdowns</p>
                </div>
                <div className="rounded-lg border border-accent-green/10 bg-accent-green/5 p-3">
                  <p className="font-bold text-2xl text-accent-green">{resolvedToday}</p>
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">Resolved Today</p>
                </div>
              </div>

              {recentBreakdowns.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
                    Recent Active
                  </p>
                  {recentBreakdowns.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between border-[var(--border-subtle)] border-b py-2 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="text-[var(--text-body)] text-sm">
                          {b.machine_name || 'Unknown Machine'}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium text-xs ${
                          b.priority === 'critical'
                            ? 'bg-accent-red/10 text-accent-red'
                            : b.priority === 'high'
                              ? 'bg-arch-accent-blue/10 text-arch-accent-blue'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                        }`}
                      >
                        {b.priority || 'normal'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </BorderBox>
        </Link>
      </div>
    </div>
  );
}
