'use client';

import { AnimatedList } from '@repo/ui/AnimatedList';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertCircle, BrainCircuit } from 'lucide-react';
import { useEffect, useState } from 'react';

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
        const res = await fetch('/api/ml/predictive-maintenance');
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
        }
      } catch (_err) {
        // Silently handle error or report to telemetry
      } finally {
        setLoading(false);
      }
    }
    fetchPredictions();
  }, []);

  if (loading) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
        <BrainCircuit className="h-5 w-5 text-[var(--text-muted)]" />
        <span className="text-[var(--text-muted)] text-sm">
          Running predictive maintenance models...
        </span>
      </div>
    );
  }

  if (predictions.length === 0) {
    return null; // Don't show if there are no high-risk alerts
  }

  return (
    <div className="mb-6 space-y-4">
      <h3 className="flex items-center gap-2 font-medium text-[var(--text-heading)] text-lg">
        <BrainCircuit className="h-5 w-5 text-[var(--accent-blue)]" />
        AI Predictive Maintenance Alerts
      </h3>
      <GlassCard className="border-[var(--accent-red)]/30 bg-[var(--accent-red)]/5">
        <AnimatedList className="divide-y divide-[var(--border-subtle)]">
          {predictions.map((p) => (
            <div key={p.machine_id} className="flex items-start gap-3 py-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-red)]" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-heading)]">{p.machine_name}</span>
                  <span className="rounded bg-[var(--accent-red)]/20 px-2 py-0.5 font-medium text-[var(--accent-red)] text-xs">
                    {p.risk_level} RISK ({(p.confidence * 100).toFixed(0)}% CONFIDENCE)
                  </span>
                </div>
                <p className="mt-1 text-[var(--text-muted)] text-sm">{p.reason}</p>
                <div className="mt-2 inline-block rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2 text-sm">
                  <span className="font-medium text-[var(--text-heading)]">Action:</span>{' '}
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
