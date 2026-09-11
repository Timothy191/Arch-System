"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { GlassCard } from "@repo/ui/GlassCard";
import { Activity, AlertCircle, RefreshCw, Server, WifiOff } from "lucide-react";

interface FuxaFrameProps {
  scadaUrl?: string;
  refreshIntervalMs?: number;
  className?: string;
}

export function FuxaFrame({
  scadaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881",
  refreshIntervalMs = 10000,
  className = "",
}: FuxaFrameProps) {
  const [isDegraded, setIsDegraded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const checkFuxaHealth = useCallback(async () => {
    setIsLoading(true);
    const start = Date.now();
    try {
      const response = await fetch("/api/health/fuxa", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await response.json();
      const elapsed = Date.now() - start;
      setLatencyMs(elapsed);

      if (response.ok && (data.status === "healthy" || data.status === "degraded")) {
        setIsDegraded(false);
        setLastHeartbeat(new Date().toLocaleTimeString());
      } else {
        setIsDegraded(true);
      }
    } catch {
      setIsDegraded(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkFuxaHealth();
    const interval = setInterval(checkFuxaHealth, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [checkFuxaHealth, refreshIntervalMs]);

  return (
    <GlassCard className={`flex flex-col border-gray-200 bg-white/90 shadow-sm ${className}`}>
      {/* Container Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-200 p-4 gap-2">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-gray-700" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">FUXA SCADA Control Panel</h3>
            <p className="text-xs text-gray-500 font-mono">{scadaUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isDegraded
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-500"
              }`}
            />
            <span className="text-xs font-medium text-gray-700">
              {isDegraded ? "Degraded State" : "Live Stream"}
            </span>
          </div>

          {/* Metrics */}
          {lastHeartbeat && (
            <span className="text-xs text-gray-500 hidden sm:inline">
              Sync: {lastHeartbeat} {latencyMs !== null && `(${latencyMs}ms)`}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={checkFuxaHealth}
            disabled={isLoading}
            className="h-8 border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative min-h-[500px] flex-1 bg-gray-50">
        {isDegraded ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-amber-50/75 backdrop-blur-xs">
            <div className="max-w-md text-center space-y-4 bg-white p-6 rounded-xl border border-amber-200 shadow-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 border border-amber-300">
                <WifiOff className="h-6 w-6 text-amber-700" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-semibold text-amber-900">
                  SCADA Telemetry Unresponsive
                </h4>
                <p className="text-xs text-amber-800">
                  The upstream FUXA SCADA server at <span className="font-mono">{scadaUrl}</span> is currently unreachable or slow to respond.
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 text-left space-y-1">
                <div className="flex items-center gap-1 font-semibold text-amber-950">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                  Database Mirror Active
                </div>
                <p className="text-amber-800">
                  Control Room operations are operating via local PostgreSQL state cache. Real-time controls will automatically reconnect once the FUXA probe recovers.
                </p>
              </div>

              <Button
                onClick={checkFuxaHealth}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                <Activity className="h-4 w-4 mr-2" />
                Retry SCADA Connection
              </Button>
            </div>
          </div>
        ) : (
          <iframe
            src={scadaUrl}
            title="FUXA SCADA Panel"
            className="h-full w-full border-0 min-h-[500px]"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        )}
      </div>
    </GlassCard>
  );
}
