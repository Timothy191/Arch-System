import {
  DEPARTMENTS,
  type Department,
  type DepartmentLiveMetricsMap,
  fetchLiveDepartmentMetrics,
} from '@repo/departments/data-access';
import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { Shield } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { CoreOperationalModules, HeroBackground, HeroRotator } from '@/features/hub';
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
    'Central operations portal for Arch Systems industrial complexes. Access administration, access control, production, drilling, plant & processing, plant inventory, engineering, control room, system overview, and database dashboards.',
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
  // - For admin role, guarantee the admin department is included first in Core Operational Modules
  // - For non-admin roles, ensure admin department is never accessible or visible
  // - Enforce Hub module ordering: 1. Administration, 2. Access Control, 3. Production, 4. Drilling
  if (userRole === 'admin') {
    const adminDept = DEPARTMENTS.find((d) => d.name === 'admin');
    if (adminDept && !rawDepartments.some((d) => d.name === 'admin')) {
      rawDepartments = [adminDept, ...rawDepartments];
    }
  } else {
    rawDepartments = rawDepartments.filter((d) => d.name !== 'admin');
  }

  // AGENT-TRACE: Unhide Plant & Processing ('plant-processing'), Plant Inventory ('plant-inventory'),
  // System Overview ('overview'), Database ('database'), and Availability & Utilization ('reports')
  // Core Operational Modules for executive/admin roles alongside DB-assigned departments.
  // Department-restricted operators only see the departments explicitly assigned in accessibleDeptIds.
  if (canSeeExecutive) {
    for (const sysModuleName of [
      'plant-processing',
      'plant-inventory',
      'overview',
      'database',
    ] as const) {
      const sysDept = DEPARTMENTS.find((d) => d.name === sysModuleName);
      if (sysDept && !rawDepartments.some((d) => d.name === sysModuleName)) {
        rawDepartments = [...rawDepartments, sysDept];
      }
    }

    if (!rawDepartments.some((d) => d.name === 'reports')) {
      const availabilityModule: Department = {
        name: 'reports',
        displayName: 'Availability & Utilization',
        route: '/control-room/reports',
        icon: 'Activity',
        description:
          'Fleet mechanical availability, equipment utilization & shift OEE analytics reports',
        color: 'blue',
        type: 'control_room',
        status: 'active',
        gridSpan: 'md:col-span-1 xl:col-span-1',
        stats: liveMetrics.engineering?.stats || { label: 'Utilization', value: '94.6%' },
        trend: liveMetrics.engineering?.trend || [91, 92, 93, 92, 94, 95, 94, 96],
        actions: [
          { label: 'View Report', href: '/control-room/reports' },
          { label: 'Shift Closeout', href: '/control-room/shift-closeout' },
        ],
      };
      rawDepartments = [...rawDepartments, availabilityModule];
    }
  }

  const HUB_MODULE_ORDER = [
    'admin',
    'access-control',
    'production',
    'drilling',
    'plant-processing',
    'plant-inventory',
    'engineering',
    'control-room',
    'overview',
    'database',
    'reports',
  ];

  rawDepartments = [...rawDepartments].sort((a, b) => {
    const idxA = HUB_MODULE_ORDER.indexOf(a.name);
    const idxB = HUB_MODULE_ORDER.indexOf(b.name);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

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
    <div className="w-full space-y-8 sm:space-y-10">
      {/* Light-theme glass hero section */}
      <section
        className="relative w-full animate-fade-up px-4 pt-2 pb-2 motion-reduce:animate-none sm:px-6"
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

      {/* Core Operational Modules - Primary Workspace Above the Fold (Fitts's Law & Primacy Effect) */}
      {departments.length === 0 ? (
        <div className="space-y-3 rounded-card border border-arch-border-subtle bg-arch-surface-secondary/40 p-8 text-center sm:p-12">
          <Shield className="mx-auto h-8 w-8 text-accent-amber" />
          <p className="font-medium text-arch-text-secondary text-sm">
            No departments assigned to your account.
          </p>
          <p className="text-arch-text-tertiary text-xs">
            Contact your administrator to request department access.
          </p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-card bg-arch-surface-secondary/40" />
          }
        >
          <CoreOperationalModules
            departments={departments}
            clearance={employeeClearance}
            canSeeExecutive={canSeeExecutive}
          />
        </Suspense>
      )}

      {/* Plugin-contributed widgets (native ArchPlugin integrations) */}
      {pluginWidgets.length > 0 && (
        <section className="animate-fade-up space-y-4" style={{ animationDelay: '0.35s' }}>
          <div className="flex items-center justify-between border-arch-border-subtle border-b pb-3">
            <h2 className="font-semibold text-arch-text-primary text-base tracking-tight sm:text-lg">
              Plugin Widgets
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
