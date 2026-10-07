'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// DataGrid requires client-side environment (StencilJS Web Components)
const DataGrid = dynamic(
  () => import('@repo/ui/components/ui/data-grid').then((mod) => mod.DataGrid),
  {
    ssr: false,
    loading: () => <div className="h-96 animate-pulse bg-arch-surface-tertiary rounded-xl" />,
  }
);

interface TelemetryRow {
  id: string;
  sensor: string;
  machine: string;
  parameter: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  timestamp: string;
}

export function ScadaPanel({ departmentId }: { departmentId: string }) {
  const [data, setData] = useState<TelemetryRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<{
    healthy: boolean;
    tripped: boolean;
    latencyMs: number;
    tagCount: number;
  }>({
    healthy: true,
    tripped: false,
    latencyMs: 12,
    tagCount: 8,
  });

  const checkScadaStatus = async () => {
    try {
      const res = await fetch('/api/control-room/scada-status');
      if (res.ok) {
        const json = await res.json();
        setGatewayStatus({
          healthy: Boolean(json.reportedFuxaHealthy),
          tripped: Boolean(json.breakerTripped),
          latencyMs: json.latencyMs || 0,
          tagCount: json.cachedTagCount || 8,
        });
      }
    } catch {
      setGatewayStatus((prev) => ({ ...prev, healthy: false }));
    }
  };

  const loadMockData = () => {
    setData([
      {
        id: '1',
        sensor: 'EX-01-ENG',
        machine: 'Excavator 01',
        parameter: 'Engine RPM',
        value: 1850,
        unit: 'rpm',
        status: 'normal',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        sensor: 'EX-01-TEMP',
        machine: 'Excavator 01',
        parameter: 'Coolant Temp',
        value: 92,
        unit: '°C',
        status: 'normal',
        timestamp: new Date().toISOString(),
      },
      {
        id: '3',
        sensor: 'DT-14-HYD',
        machine: 'Dump Truck 14',
        parameter: 'Hydraulic Pressure',
        value: 4200,
        unit: 'kPa',
        status: 'critical',
        timestamp: new Date().toISOString(),
      },
      {
        id: '4',
        sensor: 'DT-14-PAY',
        machine: 'Dump Truck 14',
        parameter: 'Payload Mass',
        value: 245,
        unit: 't',
        status: 'warning',
        timestamp: new Date().toISOString(),
      },
      {
        id: '5',
        sensor: 'DR-02-BIT',
        machine: 'Drill 02',
        parameter: 'Bit Depth',
        value: 14.2,
        unit: 'm',
        status: 'normal',
        timestamp: new Date().toISOString(),
      },
      {
        id: '6',
        sensor: 'DR-02-PEN',
        machine: 'Drill 02',
        parameter: 'Penetration Rate',
        value: 1.2,
        unit: 'm/min',
        status: 'normal',
        timestamp: new Date().toISOString(),
      },
      {
        id: '7',
        sensor: 'DOZ-05-OIL',
        machine: 'Dozer 05',
        parameter: 'Oil Pressure',
        value: 300,
        unit: 'kPa',
        status: 'normal',
        timestamp: new Date().toISOString(),
      },
      {
        id: '8',
        sensor: 'EX-03-PUMP',
        machine: 'Excavator 03',
        parameter: 'Main Pump Flow',
        value: 480,
        unit: 'L/min',
        status: 'normal',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkScadaStatus();
    loadMockData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    loadMockData();
    checkScadaStatus();
    const interval = setInterval(() => {
      checkScadaStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const columns = [
    { prop: 'machine', name: 'Equipment', size: 150 },
    { prop: 'sensor', name: 'Sensor ID', size: 120 },
    { prop: 'parameter', name: 'Parameter', size: 150 },
    {
      prop: 'value',
      name: 'Reading',
      size: 100,
      cellTemplate: (createElement: any, props: any) => {
        const val = props.model[props.prop];
        return createElement('span', { class: 'font-mono font-bold text-arch-text-primary' }, val);
      },
    },
    { prop: 'unit', name: 'Unit', size: 80 },
    {
      prop: 'status',
      name: 'Status',
      size: 100,
      cellTemplate: (createElement: any, props: any) => {
        const status = props.model[props.prop];
        let colorClass = 'bg-accent-green/10 text-accent-green border-accent-green/20';
        if (status === 'warning')
          colorClass = 'bg-accent-orange/10 text-accent-orange border-accent-orange/20';
        if (status === 'critical')
          colorClass = 'bg-accent-red/10 text-accent-red border-accent-red/20';
        return createElement(
          'span',
          {
            class: `px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md border ${colorClass}`,
          },
          status
        );
      },
    },
  ];

  return (
    <GlassCard variant="spotlight" className="p-0 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-arch-border-subtle bg-arch-surface-secondary/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-arch-brand-blue" />
          <h3 className="text-sm font-bold text-arch-text-primary">Live SCADA Telemetry</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-arch-text-secondary">
            {gatewayStatus.tripped ? (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-red animate-pulse" />
                <span className="text-accent-red font-semibold">Breaker Tripped</span>
              </>
            ) : !gatewayStatus.healthy ? (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
                <span className="text-accent-orange">Degraded ({gatewayStatus.latencyMs}ms)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                Stream Active ({gatewayStatus.tagCount} tags)
              </>
            )}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh SCADA Telemetry"
            className={`p-1.5 rounded-md hover:bg-arch-surface-tertiary transition-colors ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          >
            <RefreshCw className="w-4 h-4 text-arch-text-muted" />
          </button>
        </div>
      </div>
      <div className="flex-1 p-4">
        {data.length > 0 ? (
          <DataGrid columns={columns} source={data} height="320px" stretch={true} />
        ) : (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-arch-brand-blue border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </GlassCard>
  );
}
