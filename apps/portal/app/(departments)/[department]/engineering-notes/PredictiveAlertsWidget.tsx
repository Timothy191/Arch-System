"use client";

import { useEffect, useState } from "react";
import { AlertCircle, BrainCircuit } from "lucide-react";
import { GlassCard } from "@repo/ui/GlassCard";
import { AnimatedList } from "@repo/ui/AnimatedList";

interface MLPrediction {
  machine_id: string;
  machine_name: string;
  type: string;
  risk_level: string;
  confidence: number;
  reason: string;
  recommended_action: string;
}

export function PredictiveAlertsWidget() {
  const [predictions, setPredictions] = useState<MLPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        const res = await fetch("/api/ml/predictive-maintenance");
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
        }
      } catch (err) {
        // Silently handle error or report to telemetry
      } finally {
        setLoading(false);
      }
    }
    fetchPredictions();
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-[var(--bg-secondary)] rounded-lg animate-pulse flex items-center gap-3">
        <BrainCircuit className="w-5 h-5 text-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-muted)]">
          Running predictive maintenance models...
        </span>
      </div>
    );
  }

  if (predictions.length === 0) {
    return null; // Don't show if there are no high-risk alerts
  }

  return (
    <div className="space-y-4 mb-6">
      <h3 className="text-lg font-medium text-[var(--text-heading)] flex items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-[var(--accent-blue)]" />
        AI Predictive Maintenance Alerts
      </h3>
      <GlassCard className="border-[var(--accent-red)]/30 bg-[var(--accent-red)]/5">
        <AnimatedList className="divide-y divide-[var(--border-subtle)]">
          {predictions.map((p) => (
            <div key={p.machine_id} className="py-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--accent-red)] shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-heading)]">{p.machine_name}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent-red)]/20 text-[var(--accent-red)] font-medium">
                    {p.risk_level} RISK ({(p.confidence * 100).toFixed(0)}% CONFIDENCE)
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-1">{p.reason}</p>
                <div className="mt-2 text-sm bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-subtle)] inline-block">
                  <span className="font-medium text-[var(--text-heading)]">Action:</span>{" "}
                  {p.recommended_action}
                </div>
              </div>
            </div>
          ))}
        </AnimatedList>
      </GlassCard>
    </div>
  );
}
