import { GlassCard } from "@repo/ui/GlassCard";
import {
  generateDeformationReadings,
  DEFAULT_MINE_CENTER,
} from "@/lib/monitoring-api";
import { SatelliteMonitoringClient } from "@/components/monitoring/SatelliteMonitoringClient";

export default function ControlRoomSatellitePage() {
  const readings = generateDeformationReadings(
    DEFAULT_MINE_CENTER.lat,
    DEFAULT_MINE_CENTER.lon,
  );
  const critical = readings.filter((r) => r.level === "critical").length;
  const moderate = readings.filter((r) => r.level === "moderate").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-[var(--text-heading)]">
            Satellite Monitoring
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Sentinel-1 InSAR deformation · Real-time site overview
          </p>
        </div>
        <a
          href="/executive"
          className="px-3 py-1.5 text-xs font-medium text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 rounded-lg hover:bg-[var(--accent-cyan)]/10 transition-colors"
        >
          Executive Hub →
        </a>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard>
          <p className="system-label">Critical Alerts</p>
          <p
            className={`text-2xl font-bold mt-1 ${critical > 0 ? "text-accent-red" : "text-[var(--accent-cyan)]"}`}
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
          <p className="text-sm font-bold text-[var(--text-heading)] mt-1">
            Sentinel-1
          </p>
          <p className="system-label">InSAR</p>
        </GlassCard>
      </div>

      <SatelliteMonitoringClient readings={readings} />
    </div>
  );
}
