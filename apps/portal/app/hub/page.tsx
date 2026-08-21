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
  TrustLogos,
  ToolBanner,
  DepartmentReviews,
  CoreOperationalModules,
} from "@/features/hub";
import type { AlertEvent } from "@/features/hub";
import type { TrendDataPoint } from "@/features/hub";
import { getTools } from "@/lib/tools";
import { DEPARTMENTS } from "@repo/departments/data-access";
import { GlassCard } from "@repo/ui/GlassCard";
import { Shield, Activity, Wrench as WrenchIcon, AlertTriangle, Wrench, Power } from "lucide-react";
import { FocusModeToggle } from "@/components/FocusModeToggle";
import { withCache } from "@/lib/cache-utils";
import { cachedRSC } from "@/lib/server-cache";
import { CacheCategory } from "@repo/redis";

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.4.1";

export const dynamic = "force-dynamic";

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
): Promise<TrendDataPoint[]> {
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
            return FALLBACK_TREND_DATA;
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
          return formatted.length > 0 ? formatted : FALLBACK_TREND_DATA;
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

async function getEmployeeDepartments(
  userId: string,
  cookieList: Array<{ name: string; value: string }>,
) {
  return cachedRSC(
    ["user", userId, "accessible-dept-names"],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const { data: empData } = await db
            .from("employees")
            .select("accessible_departments")
            .eq("auth_id", userId)
            .single();

          const accessibleDeptIds = (empData?.accessible_departments ?? []) as string[];
          if (accessibleDeptIds.length === 0) return [];

          const { data: deptData } = await db
            .from("departments")
            .select("name")
            .in("id", accessibleDeptIds);

          return (deptData ?? []).map((d) => d.name);
        },
        {
          category: CacheCategory.AUTH,
          keyParts: ["user", userId, "accessible-dept-names"],
          tags: [`auth:${userId}`, "table:employees", "table:departments"],
        },
      );
    },
    {
      revalidate: 3600,
      tags: [`auth:${userId}`, "table:employees", "table:departments"],
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
  // paints. `AlertTicker` data is already fast and stays inline.
  const [
    { incidentCount, breakdownCount, offlineMachineCount },
    accessibleDeptIds,
    tools,
    alertEvents,
  ] = await Promise.all([
    getDashboardCounts(today, cookieList),
    getEmployeeDepartments(userId, cookieList),
    getTools(),
    getRecentAlertEvents(today, cookieList),
  ]);

  const departments =
    accessibleDeptIds && accessibleDeptIds.length > 0
      ? DEPARTMENTS.filter((d) => accessibleDeptIds.includes(d.name))
      : DEPARTMENTS;

  return (
    <div className="space-y-6 sm:space-y-12">
      {/* Light-theme glass hero section */}
      {/* Light-theme glass hero section */}
      <section
        className="relative overflow-hidden rounded-xl pt-1 pb-0 sm:pt-2 sm:pb-0 md:pt-3 md:pb-0 lg:pt-4 lg:pb-0 px-4 sm:px-6 md:px-10 motion-reduce:animate-none animate-fade-up"
        style={{
          animationDelay: "0s",
          animationFillMode: "both",
        }}
      >
        <HeroBackground />

        <GlassCard
          variant="liquid"
          hover={false}
          padding={false}
          className="relative z-10 rounded-xl shadow-card overflow-hidden"
        >
          {/* Inner glass highlight ring */}
          <div
            className="absolute inset-0 rounded-xl ring-1 ring-inset ring-arch-border-emphasis/40 pointer-events-none"
            aria-hidden="true"
          />

          <div className="px-4 py-3.5 sm:px-6 sm:py-4.5 w-full space-y-3.5 relative">
            {/* Eyebrow badge row */}
            <div className="flex items-center gap-3 flex-wrap liquid-shift-y">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-arch-border-subtle bg-arch-surface-secondary/80 backdrop-blur-sm text-xs font-medium tracking-wide text-arch-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" aria-hidden="true" />
                Sector-01 Active
              </span>
              <span className="text-xs font-mono text-arch-text-tertiary tracking-wider">
                PORTAL v{PORTAL_VERSION}
              </span>
              <FocusModeToggle />
              {incidentCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-red/10 text-accent-red text-[10px] font-medium tracking-wide"
                  title={`${incidentCount} open safety incidents`}
                >
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                  {incidentCount} Open
                </span>
              )}
              {breakdownCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-amber/10 text-accent-amber text-[10px] font-medium tracking-wide"
                  title={`${breakdownCount} active breakdowns`}
                >
                  <Wrench className="w-3 h-3" aria-hidden="true" />
                  {breakdownCount} Breakdown
                </span>
              )}
              {offlineMachineCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-arch-surface-tertiary text-arch-text-secondary text-[10px] font-medium tracking-wide"
                  title={`${offlineMachineCount} machines offline`}
                >
                  <Power className="w-3 h-3" aria-hidden="true" />
                  {offlineMachineCount} Offline
                </span>
              )}
            </div>

            {/* Heading, body and CTAs */}
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
            />

            {/* Trust section */}
            <TrustLogos />
          </div>
        </GlassCard>
      </section>

      {/* Department & Operational Testimonials Double Marquee */}
      <DepartmentReviews />

      {/* Operational Urgencies & Alerts */}
      <div
        className="space-y-4 animate-fade-up group/row"
        style={{ animationDelay: "0.1s", animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-arch-border-subtle">
          <h2 className="text-[17px] font-medium text-arch-text-primary flex items-center gap-2">
            <Shield className="w-4 h-4 text-arch-accent-red" />
            Live System Urgency & Incident Controls
          </h2>
        </div>
        <AlertTicker events={alertEvents} />
      </div>

      {/* Core Operational Modules - Interactive Filtered Grid */}
      <CoreOperationalModules departments={departments} />

      {/* Productivity & Workflow Tools - Marquee Banner */}
      {tools.length > 0 && (
        <section
          className="space-y-4 animate-fade-up group/row"
          style={{ animationDelay: "0.3s", animationFillMode: "both" }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-arch-border-subtle">
            <h2 className="text-[17px] font-medium text-arch-text-primary group-hover/row:text-arch-accent-blue transition-colors duration-300 flex items-center gap-2">
              <WrenchIcon className="w-4 h-4 text-arch-accent-blue opacity-70" />
              Daily Workflow & Efficiency Tools
            </h2>
          </div>

          <Suspense
            fallback={<div className="h-24 animate-pulse bg-arch-surface-tertiary rounded-xl" />}
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
        <div className="flex items-center justify-between pb-2 border-b border-arch-border-subtle">
          <h2 className="text-[17px] font-medium text-arch-text-primary flex items-center gap-2">
            <Activity className="w-4 h-4 text-arch-accent-green" />
            Operational Ingestion Telemetry
          </h2>
        </div>
        <GlassCard
          variant="default"
          padding
          className="bg-arch-surface-secondary/70 border-arch-border-subtle"
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
  const productionTrendData = await getProductionTrendData(cookieList);
  return <ProductionTrend data={productionTrendData} />;
}
