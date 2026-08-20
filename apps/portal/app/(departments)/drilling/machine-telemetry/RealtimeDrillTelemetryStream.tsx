"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { Activity, Wifi, WifiOff, RefreshCw, Gauge, Thermometer, Droplets, ArrowDown, Layers } from "lucide-react";

export interface LiveTelemetryPayload {
  machine_id: string;
  machine_name: string;
  engine_rpm?: number;
  engine_temp?: number;
  hydraulic_pressure?: number;
  vibration_level?: number;
  fuel_level?: number;
  bit_depth?: number;
  penetration_rate?: number;
  pull_down_force?: number;
  rotary_speed?: number;
  updated_at: string;
}

// AGENT-TRACE: Real-time telemetry subscriber component connecting to Redis SSE stream (/api/telemetry/drilling/stream)
export function RealtimeDrillTelemetryStream() {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [latestEvents, setLatestEvents] = useState<Record<string, LiveTelemetryPayload>>({});

  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connect() {
      setStatus("connecting");
      eventSource = new EventSource("/api/telemetry/drilling/stream");

      eventSource.onopen = () => {
        setStatus("connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.machine_id) {
            setLatestEvents((prev) => ({
              ...prev,
              [data.machine_id]: data,
            }));
          }
        } catch {
          // Heartbeat or system event
        }
      };

      eventSource.onerror = () => {
        setStatus("disconnected");
        eventSource?.close();
        // Reconnect attempt after 5 seconds
        setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      eventSource?.close();
    };
  }, []);

  const activeRigs = Object.values(latestEvents);

  return (
    <GlassCard className="p-6 space-y-4 border border-[var(--border-subtle)] shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-blue/10 border border-accent-blue/20">
            <Activity className="w-5 h-5 text-[var(--accent-blue)] animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-heading)]">
              Live Rig Telemetry Stream (Redis SSE)
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Subscribed to channel <code className="font-mono text-[var(--accent-blue)]">drilling:telemetry:stream</code>
            </p>
          </div>
        </div>

        {/* Connection status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-[var(--bg-secondary)]">
          {status === "connected" && (
            <>
              <Wifi className="w-3.5 h-3.5 text-accent-green" />
              <span className="text-accent-green font-medium">Live Connected</span>
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

      {activeRigs.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[var(--bg-secondary)]/50 border border-dashed border-[var(--border-subtle)]">
          <Activity className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Awaiting real-time telemetry packets...
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Data pushed to <code className="font-mono">/api/telemetry/drilling</code> will instantly stream here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeRigs.map((rig) => (
            <div
              key={rig.machine_id}
              className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <span className="font-semibold text-sm text-[var(--text-heading)]">
                  {rig.machine_name || `Rig ${rig.machine_id.slice(0, 8)}`}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  {new Date(rig.updated_at).toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Gauge className="w-3.5 h-3.5 text-accent-blue" />
                  <span>RPM: <strong className="text-[var(--text-heading)]">{rig.engine_rpm ?? "N/A"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Thermometer className="w-3.5 h-3.5 text-accent-amber" />
                  <span>Temp: <strong className="text-[var(--text-heading)]">{rig.engine_temp ? `${rig.engine_temp}°C` : "N/A"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Droplets className="w-3.5 h-3.5 text-accent-indigo" />
                  <span>Press: <strong className="text-[var(--text-heading)]">{rig.hydraulic_pressure ? `${rig.hydraulic_pressure} kPa` : "N/A"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <ArrowDown className="w-3.5 h-3.5 text-accent-green" />
                  <span>Bit Depth: <strong className="text-[var(--text-heading)]">{rig.bit_depth ? `${rig.bit_depth}m` : "N/A"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Layers className="w-3.5 h-3.5 text-accent-purple" />
                  <span>Pen Rate: <strong className="text-[var(--text-heading)]">{rig.penetration_rate ? `${rig.penetration_rate}m/h` : "N/A"}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
