import Link from "next/link";
import { GlassCard } from "@repo/ui/GlassCard";
import { SatelliteMonitoringClient } from "@/components/monitoring/SatelliteMonitoringClient";
import { getSatelliteMonitoringData } from "~/lib/monitoring/satellite-data";

// AGENT-TRACE: Control-room satellite view. Now a server component that reads
// real ingested InSAR rows (RLS-gated to the satellite-monitoring department)
// via getSatelliteMonitoringData — no mock generateDeformationReadings(). KPIs
// are derived from real readings (0 alerts shown honestly when nothing is
// ingested yet). Label fixed: was "Real-time site overview" (not backed by a
// real-time feed) → "site overview".
export default async function ControlRoomSatellitePage() {
  const { readings } = await getSatelliteMonitoringData();
  const critical = readings.filter((r) => r.level === "critical").length;
  const moderate = readings.filter((r) => r.level === "moderate").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-[var(--text-heading)]">Satellite Monitoring</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Sentinel-1 InSAR deformation · site overview
          </p>
        </div>
        <Link
          href="/hub/executive"
          className="px-3 py-1.5 text-xs font-medium text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 rounded-lg hover:bg-[var(--accent-blue)]/10 transition-colors"
        >
          Executive Hub →
        </Link>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard>
          <p className="system-label">Critical Alerts</p>
          <p
            className={`text-2xl font-bold mt-1 ${critical > 0 ? "text-accent-red" : "text-[var(--accent-blue)]"}`}
          >
            {critical}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="system-label">Moderate</p>
          <p
            className={`text-2xl font-bold mt-1 ${moderate > 0 ? "text-accent-blue" : "text-[var(--text-heading)]"}`}
          >
            {moderate}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="system-label">Sensor</p>
          <p className="text-sm font-bold text-[var(--text-heading)] mt-1">Sentinel-1</p>
          <p className="system-label">InSAR</p>
        </GlassCard>
      </div>

      <SatelliteMonitoringClient readings={readings} />
    </div>
  );
}
