import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { createReadReplicaClient } from "@repo/supabase/read-replica";
import {
  AlertTicker,
  ProductionTrendWrapper as ProductionTrend,
  HeroBackground,
  HeroRotator,
  ToolBanner,
  DepartmentReviews,
  CoreOperationalModules,
} from "@/features/hub";
import type { AlertEvent } from "@/features/hub";
import type { TrendDataPoint } from "@/features/hub";
import { getTools } from "@/lib/tools";
import {
  DEPARTMENTS,
  fetchLiveDepartmentMetrics,
  type DepartmentLiveMetricsMap,
} from "@repo/departments/data-access";
import { GlassCard } from "@repo/ui/GlassCard";
import { Shield, Activity, Wrench as WrenchIcon, BarChart3, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { withCache } from "@/lib/cache-utils";
import { cachedRSC } from "@/lib/server-cache";
import { CacheCategory } from "@repo/redis";
import { getAccessibleDepartmentNames } from "@/lib/hub-departments";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hub — Arch Systems",
  description:
    "Central operations portal for Arch Systems industrial complexes. Access drilling, production, engineering, control room, safety, training, and satellite monitoring dashboards.",
};

async function getDashboardCounts(
  today: string,
  cookieList: Array<{ name: string; value: string }>,
) {
  return cachedRSC(
    ["hub", "counts", today],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const [incidents, breakdowns, machines] = await Promise.all([
            db
              .from("safety_incidents")
              .select("id", { count: "exact", head: true })
              .eq("incident_date", today)
              .eq("status", "open"),
            db
              .from("breakdowns")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
              .is("deleted_at", null),
            db.from("machines").select("id", { count: "exact", head: true }).eq("active", false),
          ]);
          return {
            incidentCount: incidents.count ?? 0,
            breakdownCount: breakdowns.count ?? 0,
            offlineMachineCount: machines.count ?? 0,
          };
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ["hub", "counts", today],
          tags: ["table:safety_incidents", "table:breakdowns", "table:machines"],
        },
      );
    },
    {
      revalidate: 300,
      tags: ["table:safety_incidents", "table:breakdowns", "table:machines"],
    },
  );
}

interface ProductionTrendResult {
  data: TrendDataPoint[];
  isFallback: boolean;
}

const FALLBACK_TREND_DATA: TrendDataPoint[] = [
  { date: "08:00", Drilling: 2890, Production: 2338, Engineering: 1200 },
  { date: "09:00", Drilling: 2756, Production: 2103, Engineering: 1400 },
  { date: "10:00", Drilling: 3322, Production: 2194, Engineering: 1100 },
  { date: "11:00", Drilling: 3470, Production: 2108, Engineering: 1600 },
  { date: "12:00", Drilling: 3475, Production: 1812, Engineering: 1300 },
  { date: "13:00", Drilling: 3129, Production: 1726, Engineering: 1500 },
];

async function getProductionTrendData(
  cookieList: Array<{ name: string; value: string }>,
): Promise<ProductionTrendResult> {
  return cachedRSC(
    ["hub", "production-trend"],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const { data: trendData, error } = await db.rpc("get_production_trend", {
            p_hours_back: 24,
          });

          if (error || !trendData || trendData.length === 0) {
            return { data: FALLBACK_TREND_DATA, isFallback: true };
          }

          // Format RPC response into TrendDataPoint[]
          const hourlyMap = new Map<string, TrendDataPoint>();

          for (const row of trendData) {
            const hour = row.hour_label;
            if (!hourlyMap.has(hour)) {
              hourlyMap.set(hour, {
                date: hour,
                Drilling: 0,
                Production: 0,
                Engineering: 0,
              });
            }
            const point = hourlyMap.get(hour)!;
            // Map department name to the specific key in TrendDataPoint
            // If department name is not one of the keys, we skip or handle accordingly
            const deptKey = row.department_name as keyof Omit<TrendDataPoint, "date">;
            if (deptKey === "Drilling" || deptKey === "Production" || deptKey === "Engineering") {
              point[deptKey] = Number(row.tonnes);
            }
          }

          const formatted = Array.from(hourlyMap.values());
          return formatted.length > 0
            ? { data: formatted, isFallback: false }
            : { data: FALLBACK_TREND_DATA, isFallback: true };
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ["hub", "production-trend"],
          tags: ["table:hourly_loads", "table:machines"],
        },
      );
    },
    {
      revalidate: 300,
      tags: ["table:hourly_loads", "table:machines"],
    },
  );
}

async function getRecentAlertEvents(
  today: string,
  cookieList: Array<{ name: string; value: string }>,
): Promise<AlertEvent[]> {
  return cachedRSC(
    ["hub", "alerts", today],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const events: AlertEvent[] = [];

          // Fetch recent open safety incidents with actual severity levels
          const { data: incidents } = await db
            .from("safety_incidents")
            .select(
              "id, description, created_at, severity_id, location, severity:safety_severities(level)",
            )
            .eq("incident_date", today)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(5);

          function mapSeverityLevel(level?: string): AlertEvent["severity"] {
            if (!level) return "warning";
            const lower = level.toLowerCase();
            if (lower.includes("critical") || lower.includes("high") || lower.includes("severe")) {
              return "critical";
            }
            if (
              lower.includes("warning") ||
              lower.includes("medium") ||
              lower.includes("moderate")
            ) {
              return "warning";
            }
            return "info";
          }

          if (incidents) {
            for (const incident of incidents) {
              const sev = incident.severity as unknown as {
                level: string;
              } | null;
              events.push({
                id: `incident-${incident.id}`,
                type: "incident",
                title: incident.location ? `${incident.location}: Incident` : "Safety Incident",
                description: incident.description,
                timestamp: incident.created_at,
                severity: mapSeverityLevel(sev?.level),
                href: "/safety/daily-log",
              });
            }
          }

          // Fetch recent active breakdowns
          const { data: breakdownsData } = await db
            .from("breakdowns")
            .select("id, machine_name, machine_type, reason, created_at, date_in")
            .eq("status", "active")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(5);

          if (breakdownsData) {
            for (const b of breakdownsData) {
              events.push({
                id: `breakdown-${b.id}`,
                type: "breakdown",
                title: b.machine_name
                  ? `${b.machine_name} Breakdown`
                  : `${b.machine_type} Breakdown`,
                description: b.reason,
                timestamp: b.created_at,
                severity: "warning",
                href: "/engineering/breakdowns",
              });
            }
          }

          // Sort by timestamp descending and limit to 8 total
          return events
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 8);
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ["hub", "alerts", today],
          tags: ["table:safety_incidents", "table:breakdowns"],
        },
      );
    },
    {
      revalidate: 300,
      tags: ["table:safety_incidents", "table:breakdowns"],
    },
  );
}

// AGENT-TRACE: getEmployeeDepartments moved to @/lib/hub-departments for shared
// cached access between layout.tsx and page.tsx.

async function getLiveDepartmentMetrics(
  today: string,
  cookieList: Array<{ name: string; value: string }>,
): Promise<DepartmentLiveMetricsMap> {
  return cachedRSC(
    ["hub", "live-department-metrics", today],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          return fetchLiveDepartmentMetrics(db, today);
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ["hub", "live-department-metrics", today],
          tags: [
            "table:hourly_loads",
            "table:daily_logs",
            "table:production_logs",
            "table:safety_incidents",
            "table:breakdowns",
            "table:machines",
          ],
        },
      );
    },
    {
      revalidate: 60,
      tags: [
        "table:hourly_loads",
        "table:daily_logs",
        "table:production_logs",
        "table:safety_incidents",
        "table:breakdowns",
        "table:machines",
      ],
    },
  );
}

export default async function HubPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user || !user.id) {
    redirect("/login");
  }

  const userId = user.id as string;
  const today = new Date().toISOString().split("T")[0] as string;

  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();

  // GAP-3: only fetch the fast, above-the-fold data in the main page so the
  // shell streams immediately. The slow ProductionTrend fetch is hoisted into
  // a Suspense child (`ProductionTrendSection`) so it streams after the shell
  // paints. `AlertTicker` and live shift metrics stay fast and cached.
  const [
    { incidentCount, breakdownCount, offlineMachineCount },
    accessibleDeptIds,
    tools,
    alertEvents,
    liveMetrics,
    userRole,
  ] = await Promise.all([
    getDashboardCounts(today, cookieList),
    getAccessibleDepartmentNames(userId, cookieList),
    getTools(),
    getRecentAlertEvents(today, cookieList),
    getLiveDepartmentMetrics(today, cookieList),
    // AGENT-TRACE: Fetch user role in parallel to conditionally show executive dashboard link
    supabase
      .from("employees")
      .select("role")
      .eq("auth_id", userId)
      .single()
      .then(({ data }) => data?.role ?? null),
  ]);

  const canSeeExecutive = userRole === "admin" || userRole === "manager";

  // AGENT-TRACE: Admin/manager users see all departments. Regular users with
  // zero assigned departments get an explicit empty state instead of silently
  // seeing every department (authorization safety).
  const hasAssignedDepts = accessibleDeptIds && accessibleDeptIds.length > 0;
  const rawDepartments = hasAssignedDepts
    ? DEPARTMENTS.filter((d) => accessibleDeptIds.includes(d.name))
    : canSeeExecutive
      ? DEPARTMENTS
      : [];

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
          animationDelay: "0s",
          animationFillMode: "both",
        }}
      >
        <HeroBackground />

        {/* Heading, 3D Hero Carousel with separate cards, and CTAs */}
        <HeroRotator
          defaultTitle="Central Operations Portal"
          defaultDescription="Centralized monitoring and control system for Arch Systems industrial complexes. Access Modbus diagnostics, machine breakdowns, shifts, and live telemetry."
          primaryHref={
            accessibleDeptIds.includes("control-room")
              ? "/control-room"
              : accessibleDeptIds.length > 0
                ? `/${accessibleDeptIds[0]}`
                : "/"
          }
          primaryLabel={
            accessibleDeptIds.includes("control-room") ? "Launch Monitor" : "Go to Department"
          }
          secondaryHref={
            accessibleDeptIds.includes("training")
              ? "/training"
              : accessibleDeptIds.length > 0
                ? `/${accessibleDeptIds[0]}`
                : "/"
          }
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
          style={{ animationDelay: "0.05s", animationFillMode: "both" }}
        >
          <Link
            href="/hub/executive"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-xs font-medium border border-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/20 hover:border-[var(--accent-blue)]/30 transition-all"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Executive Dashboard
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Department & Operational Testimonials Double Marquee */}
      <DepartmentReviews />

      {/* Operational Urgencies & Alerts */}
      <div
        className="space-y-4 animate-fade-up group/row"
        style={{ animationDelay: "0.1s", animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-arch-border-subtle">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary flex items-center gap-2.5">
            <span className="p-1 rounded-md bg-accent-red/10 text-accent-red">
              <Shield className="w-4 h-4" />
            </span>
            Live System Urgency & Incident Controls
          </h2>
        </div>
        <AlertTicker events={alertEvents} />
      </div>

      {/* Core Operational Modules - Interactive Filtered Grid */}
      {departments.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl bg-arch-surface-secondary/40 border border-arch-border-subtle space-y-3">
          <Shield className="w-8 h-8 mx-auto text-accent-amber" />
          <p className="text-sm font-medium text-arch-text-secondary">
            No departments assigned to your account.
          </p>
          <p className="text-xs text-arch-text-tertiary">
            Contact your administrator to request department access.
          </p>
        </div>
      ) : (
        <CoreOperationalModules departments={departments} />
      )}

      {/* Productivity & Workflow Tools - Marquee Banner */}
      {tools.length > 0 && (
        <section
          className="space-y-4 animate-fade-up group/row"
          style={{ animationDelay: "0.3s", animationFillMode: "both" }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-arch-border-subtle">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary group-hover/row:text-arch-accent-blue transition-colors duration-300 flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-arch-accent-blue/10 text-arch-accent-blue">
                <WrenchIcon className="w-4 h-4" />
              </span>
              Daily Workflow & Efficiency Tools
            </h2>
          </div>

          <Suspense
            fallback={<div className="h-28 animate-pulse bg-arch-surface-tertiary rounded-2xl" />}
          >
            <ToolBanner tools={tools} />
          </Suspense>
        </section>
      )}

      {/* Industrial Insights & Production Trends */}
      <section
        className="space-y-4 animate-fade-up group/row"
        style={{ animationDelay: "0.4s", animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-arch-border-subtle">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary flex items-center gap-2.5">
            <span className="p-1 rounded-md bg-accent-green/10 text-accent-green">
              <Activity className="w-4 h-4" />
            </span>
            Operational Ingestion Telemetry
          </h2>
        </div>
        <GlassCard
          variant="default"
          padding
          className="bg-arch-surface-secondary/70 border border-arch-border-subtle rounded-2xl p-5 sm:p-6"
        >
          <Suspense
            fallback={<div className="h-64 animate-pulse bg-arch-surface-tertiary rounded-xl" />}
          >
            <ProductionTrendSection />
          </Suspense>
        </GlassCard>
      </section>
    </div>
  );
}

/**
 * Async server component — fetches its own data inside the Suspense boundary
 * (GAP-3) so the production trend streams after the shell paints.
 */
async function ProductionTrendSection() {
  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();
  const { data: productionTrendData, isFallback } = await getProductionTrendData(cookieList);
  return <ProductionTrend data={productionTrendData} isFallback={isFallback} />;
}
