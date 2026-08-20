"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { Activity, Wifi, WifiOff, RefreshCw, AlertTriangle, Radio, ShieldAlert } from "lucide-react";

export interface InSARStreamPoint {
  id: string;
  department_id: string;
  satellite_name: string;
  acquisition_date: string;
  reference_date: string;
  location_name: string;
  latitude: number;
  longitude: number;
  displacement_mm: number;
  coherence_index: number;
  risk_level: "none" | "minor" | "moderate" | "critical";
  cog_url?: string;
  created_at: string;
}

// AGENT-TRACE: Component subscribing to Redis SSE channel for live InSAR GeoTIFF deformation points
export function RealtimeInSARStream() {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [points, setPoints] = useState<InSARStreamPoint[]>([]);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connect() {
      setStatus("connecting");
      eventSource = new EventSource("/api/telemetry/satellite/insar/stream");

      eventSource.onopen = () => {
        setStatus("connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id && data.displacement_mm !== undefined) {
            setPoints((prev) => [data, ...prev.slice(0, 19)]); // Keep last 20 events
          }
        } catch {
          // Heartbeat or connection event
        }
      };

      eventSource.onerror = () => {
        setStatus("disconnected");
        eventSource?.close();
        setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      eventSource?.close();
    };
  }, []);

  return (
    <GlassCard className="p-6 space-y-4 border border-[var(--border-subtle)] shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-blue/10 border border-accent-blue/20">
            <Radio className="w-5 h-5 text-[var(--accent-blue)] animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-heading)] flex items-center gap-2">
              InSAR GeoTIFF Real-Time Stream (Redis SSE)
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Subscribed to channel <code className="font-mono text-[var(--accent-blue)]">satellite:insar:stream</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-[var(--bg-secondary)]">
          {status === "connected" && (
            <>
              <Wifi className="w-3.5 h-3.5 text-accent-green" />
              <span className="text-accent-green font-medium">Stream Connected</span>
            </>
          )}
          {status === "connecting" && (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-accent-amber animate-spin" />
              <span className="text-accent-amber font-medium">Connecting...</span>
            </>
          )}
          {status === "disconnected" && (
            <>
              <WifiOff className="w-3.5 h-3.5 text-accent-red" />
              <span className="text-accent-red font-medium">Disconnected</span>
            </>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[var(--bg-secondary)]/50 border border-dashed border-[var(--border-subtle)]">
          <Activity className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Awaiting InSAR satellite raster updates...
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Raster data posted to <code className="font-mono">/api/telemetry/satellite/insar</code> will stream here live.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {points.map((pt) => (
            <div
              key={pt.id}
              className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                    pt.risk_level === "critical"
                      ? "bg-accent-red/10 text-accent-red border-accent-red/20"
                      : pt.risk_level === "moderate"
                      ? "bg-accent-amber/10 text-accent-amber border-accent-amber/20"
                      : "bg-accent-green/10 text-accent-green border-accent-green/20"
                  }`}
                >
                  {pt.risk_level.toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-[var(--text-heading)]">
                    {pt.location_name} ({pt.satellite_name})
                  </p>
                  <p className="text-[var(--text-muted)] font-mono text-[10px]">
                    Lat: {pt.latitude.toFixed(4)}, Lon: {pt.longitude.toFixed(4)} | Coherence: {pt.coherence_index}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`font-bold text-sm ${
                    Math.abs(pt.displacement_mm) >= 15
                      ? "text-accent-red"
                      : Math.abs(pt.displacement_mm) >= 8
                      ? "text-accent-amber"
                      : "text-accent-green"
                  }`}
                >
                  {pt.displacement_mm > 0 ? `+${pt.displacement_mm}` : pt.displacement_mm} mm/mo
                </span>
                {pt.risk_level === "critical" && (
                  <p className="text-[10px] text-accent-red flex items-center justify-end gap-1 font-medium mt-0.5">
                    <ShieldAlert className="w-3 h-3" /> Safety Alert Triggered
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
