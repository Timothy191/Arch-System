import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Divider } from '@repo/ui/Divider';
import nextDynamic from 'next/dynamic';
import { getDepartmentContext } from '~/lib/dept-context';
import {
  getAccessControlMetrics,
  getBadgeStatusDistribution,
  getEntityBadgeStatus,
  getHourlyAccessStats,
  getLivePerimeterGates,
  getMusterRollCall,
  getRecentAccessActivity,
} from './actions';
import { HeadcountMusterBanner } from './components/HeadcountMusterBanner';
import { PerimeterGateHUD } from './components/PerimeterGateHUD';
import { QuickActionHub } from './components/QuickActionHub';

const DashboardKPIGrid = nextDynamic(() => import('./components/DashboardKPIGrid'), {
  loading: () => <Skeleton className="h-[140px] w-full" />,
});
const DashboardChartsRow = nextDynamic(() => import('./components/DashboardChartsRow'), {
  loading: () => <Skeleton className="h-[260px] w-full" />,
});
const DashboardActivityFeed = nextDynamic(() => import('./components/DashboardActivityFeed'), {
  loading: () => <Skeleton className="h-[360px] w-full" />,
});
const DashboardEntityStatus = nextDynamic(() => import('./components/DashboardEntityStatus'), {
  loading: () => <Skeleton className="h-[360px] w-full" />,
});

export default async function AccessControlDashboardPage() {
  const { deptId, today } = await getDepartmentContext({
    department: 'access-control',
  });

  const [
    metrics,
    activity,
    entityStatus,
    hourlyStats,
    distribution,
    perimeterGates,
    musterSummary,
  ] = await Promise.all([
    getAccessControlMetrics(deptId),
    getRecentAccessActivity(deptId, 10),
    getEntityBadgeStatus(deptId),
    getHourlyAccessStats(deptId, today),
    getBadgeStatusDistribution(deptId),
    getLivePerimeterGates(),
    getMusterRollCall(deptId),
  ]);

  return (
    <div className="space-y-6">
      {/* 1. Real-Time Headcount & Emergency Blast/Muster Command Strip */}
      <HeadcountMusterBanner
        totalSouls={musterSummary.totalSoulsOnSite}
        employeesCount={
          entityStatus.find((e) => e.type === 'Employees')?.active ??
          musterSummary.records.filter((r) => r.entityType === 'personnel').length
        }
        contractorsCount={
          entityStatus.find((e) => e.type === 'Contractors')?.active ??
          musterSummary.records.filter(
            (r) => r.company !== 'Mine Operations' && r.company !== 'Internal'
          ).length
        }
        visitorsCount={musterSummary.records.filter((r) => r.entityType === 'visitor').length}
        vehiclesCount={entityStatus.find((e) => e.type === 'Vehicles')?.active ?? 0}
        blastStatus={musterSummary.blastStatus}
      />

      {/* 2. Rapid Operational Action Center */}
      <QuickActionHub />

      {/* 3. Perimeter Barriers & Gate Telemetry HUD */}
      <PerimeterGateHUD initialGates={perimeterGates} />

      <Divider variant="dotted" label="CREDENTIAL METRICS & ZONE SURVEILLANCE" />

      {/* 4. KPI Bento Matrix */}
      <DashboardKPIGrid metrics={metrics} />

      {/* 5. Hourly Throughput & Badge Lifecycle Analytics */}
      <DashboardChartsRow hourlyStats={hourlyStats} distribution={distribution} />

      {/* 6. Live Audit Stream & Entity Coverage Breakdown */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashboardActivityFeed activity={activity} />
        </div>
        <div className="xl:col-span-1">
          <DashboardEntityStatus entityStatus={entityStatus} />
        </div>
      </div>
    </div>
  );
}
