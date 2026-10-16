import {
  DEPARTMENTS,
  type DepartmentLiveMetricsMap,
  fetchLiveDepartmentMetrics,
} from '@repo/departments/data-access';
import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { ArrowUpRight, BarChart3, Shield } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  CoreOperationalModules,
  DepartmentReviews,
  HeroBackground,
  HeroRotator,
} from '@/features/hub';
import { withCache } from '@/lib/cache-utils';
import {
  getAccessibleDepartmentNames,
  getEmployeeClearance,
  getEmployeeRole,
} from '@/lib/hub-departments';
import { getPluginWidgets } from '@/lib/plugins/consumers';
import { cachedRSC } from '@/lib/server-cache';

export const metadata: Metadata = {
  title: 'Hub — Arch Systems',
  description:
    'Central operations portal for Arch Systems industrial complexes. Access drilling, production, engineering, control room, and satellite monitoring dashboards.',
};

async function getDashboardCounts(
  today: string,
  cookieList: Array<{ name: string; value: string }>
) {
  return cachedRSC(
    ['hub', 'counts', today],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const [breakdowns, machines] = await Promise.all([
            db
              .from('breakdowns')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active')
              .is('deleted_at', null),

            db.from('machines').select('id', { count: 'exact', head: true }).eq('active', false),
          ]);
          return {
            incidentCount: 0,
            breakdownCount: breakdowns.count ?? 0,
            offlineMachineCount: machines.count ?? 0,
          };
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ['hub', 'counts', today],
          tags: ['table:breakdowns', 'table:machines'],
        }
      );
    },
    {
      revalidate: 300,
      tags: ['table:breakdowns', 'table:machines'],
    }
  );
}

// AGENT-TRACE: getEmployeeDepartments moved to @/lib/hub-departments for shared
// cached access between layout.tsx and page.tsx.

async function getLiveDepartmentMetrics(
  today: string,
  cookieList: Array<{ name: string; value: string }>
): Promise<DepartmentLiveMetricsMap> {
  return cachedRSC(
    ['hub', 'live-department-metrics', today],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          return fetchLiveDepartmentMetrics(db, today);
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ['hub', 'live-department-metrics', today],
          tags: [
            'table:hourly_loads',
            'table:daily_logs',
            'table:production_logs',

            'table:breakdowns',
            'table:machines',
          ],
        }
      );
    },
    {
      revalidate: 60,
      tags: [
        'table:hourly_loads',
        'table:daily_logs',
        'table:production_logs',

        'table:breakdowns',
        'table:machines',
      ],
    }
  );
}

export default async function HubPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user?.id) {
    redirect('/login');
  }

  const userId = user.id as string;
  const today = new Date().toISOString().split('T')[0] as string;

  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();

  // GAP-3: only fetch the fast, above-the-fold data in the main page so the
  // shell streams immediately.
  //
  // AGENT-TRACE: Using Promise.allSettled so a single DB/network failure
  // (e.g. local Supabase down, Redis unavailable) never propagates an
  // unhandled rejection to HubPage and triggers the error boundary.
  // Each slot has a typed safe default so the page always renders.
  const [
    dashboardCountsResult,
    accessibleDeptIdsResult,
    liveMetricsResult,
    userRoleResult,
    clearanceResult,
  ] = await Promise.allSettled([
    getDashboardCounts(today, cookieList),
    getAccessibleDepartmentNames(userId, cookieList),
    getLiveDepartmentMetrics(today, cookieList),
    getEmployeeRole(userId, cookieList),
    getEmployeeClearance(userId, cookieList),
  ]);

  const { incidentCount, breakdownCount, offlineMachineCount } =
    dashboardCountsResult.status === 'fulfilled'
      ? dashboardCountsResult.value
      : { incidentCount: 0, breakdownCount: 0, offlineMachineCount: 0 };

  const accessibleDeptIds =
    accessibleDeptIdsResult.status === 'fulfilled' ? accessibleDeptIdsResult.value : [];

  const liveMetrics = liveMetricsResult.status === 'fulfilled' ? liveMetricsResult.value : {};

  const userRole = userRoleResult.status === 'fulfilled' ? userRoleResult.value : null;

  const employeeClearance =
    clearanceResult.status === 'fulfilled'
      ? clearanceResult.value
      : { state: 'clear' as const, details: [] as string[] };

  // Plugin widgets come from the failure-isolated consumers wrapper — a broken
  // plugin orchestrator degrades to an empty grid, never a broken hub page.
  const pluginWidgets = await getPluginWidgets();

  const canSeeExecutive = userRole === 'admin' || userRole === 'manager';

  // AGENT-TRACE: Admin/manager users see all departments. Regular users with
  // zero assigned departments get an explicit empty state instead of silently
  // seeing every department (authorization safety).
  const hasAssignedDepts = accessibleDeptIds && accessibleDeptIds.length > 0;
  let rawDepartments = hasAssignedDepts
    ? DEPARTMENTS.filter((d) => accessibleDeptIds.includes(d.name))
    : canSeeExecutive
      ? DEPARTMENTS
      : [];

  // AGENT-TRACE: Administration department is strictly restricted to admin users:
  // - For admin role, guarantee the admin department is included in Core Operational Modules
  // - For non-admin roles, ensure admin department is never accessible or visible
  if (userRole === 'admin') {
    if (!rawDepartments.some((d) => d.name === 'admin')) {
      const adminDept = DEPARTMENTS.find((d) => d.name === 'admin');
      if (adminDept) {
        rawDepartments = [...rawDepartments, adminDept];
      }
    }
  } else {
    rawDepartments = rawDepartments.filter((d) => d.name !== 'admin');
  }

  const departments = rawDepartments.map((dept) => {
    const overlay = liveMetrics[dept.name];
    if (!overlay) return dept;
    return {
      ...dept,
      stats: overlay.stats || dept.stats,
      trend: overlay.trend || dept.trend,
      status: overlay.status || dept.status,
    };
  });

  return (
    <div className="space-y-8 sm:space-y-10 w-full">
      {/* Light-theme glass hero section */}
      <section
        className="relative w-full pt-2 pb-2 px-4 sm:px-6 motion-reduce:animate-none animate-fade-up"
        style={{
          animationDelay: '0s',
          animationFillMode: 'both',
        }}
      >
        <HeroBackground />

        {/* Heading, 3D Hero Carousel with separate cards, and CTAs */}
        <HeroRotator
          defaultTitle="Central Operations Portal"
          defaultDescription="Centralized monitoring and control system for Arch Systems industrial complexes. Access Modbus diagnostics, machine breakdowns, shifts, and live telemetry."
          primaryHref={
            accessibleDeptIds.includes('control-room')
              ? '/control-room'
              : accessibleDeptIds.length > 0
                ? `/${accessibleDeptIds[0]}`
                : '/'
          }
          primaryLabel={
            accessibleDeptIds.includes('control-room') ? 'Launch Monitor' : 'Go to Department'
          }
          secondaryHref={accessibleDeptIds.length > 0 ? `/${accessibleDeptIds[0]}` : '/'}
          secondaryLabel="System Guidelines"
          departments={departments}
          incidentCount={incidentCount}
          breakdownCount={breakdownCount}
          offlineMachineCount={offlineMachineCount}
        />
      </section>

      {/* Executive Dashboard link (admin/manager only) */}
      {canSeeExecutive && (
        <div
          className="flex justify-end animate-fade-up"
          style={{ animationDelay: '0.05s', animationFillMode: 'both' }}
        >
          <Link
            href="/hub/executive"
            className="inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full bg-arch-surface-secondary/80 hover:bg-arch-surface-secondary text-arch-text-primary hover:text-arch-accent-blue text-xs font-semibold border border-arch-border-subtle hover:border-arch-accent-blue/40 backdrop-blur-md shadow-sm hover:shadow-card transition-all group"
          >
            <span className="p-1 rounded-full bg-arch-accent-blue/10 text-arch-accent-blue flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5" />
            </span>
            <span>Executive Dashboard</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-arch-accent-blue transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      )}

      {/* Department & Operational Testimonials Double Marquee */}
      <DepartmentReviews />

      {/* Core Operational Modules - Interactive Filtered Grid */}
      {departments.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-card bg-arch-surface-secondary/40 border border-arch-border-subtle space-y-3">
          <Shield className="w-8 h-8 mx-auto text-accent-amber" />
          <p className="text-sm font-medium text-arch-text-secondary">
            No departments assigned to your account.
          </p>
          <p className="text-xs text-arch-text-tertiary">
            Contact your administrator to request department access.
          </p>
        </div>
      ) : (
        <CoreOperationalModules departments={departments} clearance={employeeClearance} />
      )}

      {/* Plugin-contributed widgets (native ArchPlugin integrations) */}
      {pluginWidgets.length > 0 && (
        <section className="space-y-4 animate-fade-up" style={{ animationDelay: '0.35s' }}>
          <div className="flex items-center justify-between pb-3 border-b border-arch-border-subtle">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary">
              Plugin Widgets
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {pluginWidgets.map((widget) => (
              <div key={widget.id} className={widget.gridSpan ?? 'col-span-1'}>
                <widget.component departmentId={accessibleDeptIds[0] ?? ''} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
