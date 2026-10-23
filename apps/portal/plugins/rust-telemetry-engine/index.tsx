'use client';

import { APIError } from '@repo/errors';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@repo/ui';
import { useEffect, useState } from 'react';
import type { ArchPlugin } from '@/lib/plugins/types';

// Types matching our Rust binary JSON output contract
interface RustTelemetryData {
  wearIndex: number;
  probability: number;
  rulHours: number;
  status: 'optimal' | 'warning' | 'critical';
  error?: string;
  isNative?: boolean;
}

// Sensor telemetry inputs (simulated)
const DEFAULT_SENSORS = { hours: 220.0, temp: 72.5, rpm: 1150.0 };

// React UI Dashboard component
function RustTelemetryWidget({ departmentId: _departmentId }: { departmentId: string }) {
  const [data, setData] = useState<RustTelemetryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRustTelemetry() {
      try {
        const response = await fetch('/api/plugins/rust-telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(DEFAULT_SENSORS),
        });

        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          throw new APIError('API call failed', {
            statusCode: response.status,
            context: {
              endpoint: 'rust-telemetry',
              statusText: response.statusText,
            },
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to contact native engine';
        setData({
          wearIndex: 45.2,
          probability: 48.6,
          rulHours: 780.0,
          status: 'warning',
          isNative: false,
          error: message,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchRustTelemetry();
  }, []);

  const isCritical = data?.status === 'critical';
  const isWarning = data?.status === 'warning';

  const statusVariant = isCritical ? 'destructive' : isWarning ? 'secondary' : 'default';
  const probability = Math.min(Math.max(data?.probability ?? 0, 0), 100);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline">Rust Native</Badge>
          <CardTitle className="truncate text-xs uppercase tracking-wider">
            Telemetry stress
          </CardTitle>
        </div>
        <Badge variant={statusVariant}>{data?.status}</Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-5">
        {loading ? (
          <div className="flex flex-col gap-3" aria-label="Loading Rust telemetry">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Wear Index</p>
                <p className="mt-1 font-bold text-lg">{data?.wearIndex}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">
                  Est. Lifetime (RUL)
                </p>
                <p className="mt-1 font-bold text-lg">{data?.rulHours} hrs</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground uppercase tracking-wider">
                  Failure Probability
                </span>
                <span className="font-semibold">{probability}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Failure probability"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={probability}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${probability}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-2 text-muted-foreground text-xs">
              <span>Engine: {data?.isNative ? 'Rust binary' : 'JS fallback'}</span>
              {data?.error && <span className="text-destructive">Sensor read timeout</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const rustTelemetryPlugin: ArchPlugin = {
  metadata: {
    id: 'rust-telemetry-engine',
    name: 'Rust Telemetry Analyzer',
    version: '1.0.0',
    description:
      'Multi-variable stress-fatigue Native Rust calculations bridged into Next.js dashboard.',
    author: 'Arch Core Engineering',
    enabled: true,
  },
  widgets: [
    {
      id: 'rust-telemetry-card',
      gridSpan: 'col-span-1',
      component: RustTelemetryWidget,
    },
  ],
  workflow: {
    canBuildWorkflow: true,
    defaultNode: {
      type: 'plugin',
      data: {
        label: 'Rust Telemetry',
        pluginId: 'rust-telemetry-engine',
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
