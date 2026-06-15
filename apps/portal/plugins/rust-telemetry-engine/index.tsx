"use client";

import React, { useEffect, useState } from "react";
import { ArchPlugin } from "../../lib/plugins/types";
import { APIError } from "@repo/errors";

// Types matching our Rust binary JSON output contract
interface RustTelemetryData {
  wearIndex: number;
  probability: number;
  rulHours: number;
  status: "optimal" | "warning" | "critical";
  error?: string;
  isNative?: boolean;
}

// React UI Dashboard component
function RustTelemetryWidget({
  departmentId: _departmentId,
}: {
  departmentId: string;
}) {
  const [data, setData] = useState<RustTelemetryData | null>(null);
  const [loading, setLoading] = useState(true);

  // Sensor telemetry inputs (simulated)
  const sensors = { hours: 220.0, temp: 72.5, rpm: 1150.0 };

  useEffect(() => {
    async function fetchRustTelemetry() {
      try {
        const response = await fetch("/api/plugins/rust-telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sensors),
        });

        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          throw new APIError("API call failed", {
            statusCode: response.status,
            context: {
              endpoint: "rust-telemetry",
              statusText: response.statusText,
            },
          });
        }
      } catch (err: any) {
        setData({
          wearIndex: 45.2,
          probability: 48.6,
          rulHours: 780.0,
          status: "warning",
          isNative: false,
          error: err.message || "Failed to contact native engine",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchRustTelemetry();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-5 shadow-diffusion-xl animate-pulse h-[220px] flex items-center justify-center">
        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">
          Loading Rust Telemetry...
        </span>
      </div>
    );
  }

  const isCritical = data?.status === "critical";
  const isWarning = data?.status === "warning";

  const statusColor = isCritical
    ? "text-accent-red border-accent-red/20 bg-accent-red/10"
    : isWarning
      ? "text-accent-blue border-accent-blue/20 bg-accent-blue/10"
      : "text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/10";

  return (
    <div className="relative group overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#0c0914] to-[#07050d] p-5 shadow-diffusion-xl backdrop-blur-xl transition-all duration-300 hover:border-violet-500/30">
      {/* Dynamic Glow effect */}
      <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl transition-all duration-500 group-hover:bg-violet-500/15" />

      <div className="flex items-center justify-between border-b border-violet-500/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-violet-400 border border-violet-500/30 rounded px-1.5 py-0.5 uppercase bg-violet-500/5">
            Rust Native
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-heading)]">
            Telemetry stress
          </h4>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-[9px] font-medium uppercase border ${statusColor}`}
        >
          {data?.status}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Wear Index
            </p>
            <p className="text-lg font-bold text-[var(--text-heading)] mt-0.5">
              {data?.wearIndex}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Est. Lifetime (RUL)
            </p>
            <p className="text-lg font-bold text-[var(--text-heading)] mt-0.5">
              {data?.rulHours} hrs
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center text-[10px] mb-1">
            <span className="text-[var(--text-secondary)] uppercase tracking-wider">
              Failure Probability
            </span>
            <span className="text-violet-400 font-semibold">
              {data?.probability}%
            </span>
          </div>
          <div className="w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden border border-[var(--border-default)]">
            <div className="bg-gradient-to-r from-violet-600 to-violet-400 h-full rounded-full transition-all duration-500 w-[88%]" />
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-[#1c1c1c] pt-2 text-[10px] text-[var(--text-secondary)]">
          <span>
            Engine type:{" "}
            {data?.isNative ? "Rust binary (compiled)" : "JS fallback"}
          </span>
          {data?.error && (
            <span className="text-accent-red italic text-[9px]">
              Sensor read timeout
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const rustTelemetryPlugin: ArchPlugin = {
  metadata: {
    id: "rust-telemetry-engine",
    name: "Rust Telemetry Analyzer",
    version: "1.0.0",
    description:
      "Multi-variable stress-fatigue Native Rust calculations bridged into Next.js dashboard.",
    author: "Arch Core Engineering",
    enabled: true,
  },
  widgets: [
    {
      id: "rust-telemetry-card",
      gridSpan: "col-span-1",
      component: RustTelemetryWidget,
    },
  ],
  workflow: {
    canBuildWorkflow: true,
    defaultNode: {
      type: "plugin",
      data: {
        label: "Rust Telemetry",
        pluginId: "rust-telemetry-engine",
        config: {
          hours: 220.0,
          temp: 72.5,
          rpm: 1150.0,
        },
      },
    },
  },
};

export default rustTelemetryPlugin;
