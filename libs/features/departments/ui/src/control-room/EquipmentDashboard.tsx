'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { BadgeAlert, CheckCircle2, Factory, Loader2, Map, ShieldAlert, Truck } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

interface FleetItem {
  id: string;
  code: string;
  category: 'truck' | 'excavator' | 'dozer' | 'drill' | 'grader' | 'bowser' | 'ldv' | 'ancillary';
  status: 'operational' | 'breakdown' | 'standby' | 'maintenance';
  hour_meter: number;
}

export function EquipmentDashboard({ departmentId }: { departmentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [fleet, setFleet] = useState<FleetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadFleet() {
      try {
        const res = await fetch(`/api/departments/${departmentId}/fleet`);
        if (!res.ok) throw new Error('Failed to fetch fleet');
        const data = await res.json();
        if (mounted) {
          setFleet(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) setIsLoading(false);
      }
    }
    loadFleet();
    return () => {
      mounted = false;
    };
  }, [departmentId]);

  const handleReportBreakdown = async (equipmentId: string, code: string) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/engineering/breakdown-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentId,
            description: `Operator reported breakdown via map for ${code}`,
          }),
        });

        if (!res.ok) throw new Error('Failed to dispatch workflow');

        setActionMessage(`Workflow dispatched: Breakdown escalation started for ${code}.`);

        // Optimistically update the UI status
        setFleet((prev) =>
          prev.map((item) => (item.id === equipmentId ? { ...item, status: 'breakdown' } : item))
        );

        setTimeout(() => setActionMessage(null), 5000);
      } catch (err) {
        setActionMessage(`Error: Could not trigger workflow.`);
        setTimeout(() => setActionMessage(null), 5000);
      }
    });
  };

  const renderIcon = (category: string) => {
    switch (category) {
      case 'truck':
        return <Truck className="w-5 h-5" />;
      case 'excavator':
        return <Factory className="w-5 h-5" />;
      default:
        return <Map className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-arch-text-primary">Live Equipment Map & Data Grid</h3>
        {actionMessage && (
          <span className="text-xs font-semibold text-arch-brand-blue bg-arch-brand-blue/10 px-3 py-1 rounded-full animate-in fade-in">
            {actionMessage}
          </span>
        )}
      </div>

      <GlassCard variant="spotlight" className="p-0 overflow-hidden">
        <div className="p-5 border-b border-arch-border-subtle bg-arch-surface-secondary/50 flex justify-between items-center">
          <h4 className="text-sm font-semibold text-arch-text-primary">Active Pit Assets</h4>
          <div className="flex gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" /> Operational
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeAlert className="w-3.5 h-3.5 text-accent-orange" /> Maintenance
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-accent-red" /> Breakdown
            </span>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-arch-brand-blue" />
            </div>
          ) : fleet.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-arch-text-muted text-sm font-medium">
              No equipment data found for this department.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {fleet.map((item: FleetItem) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 p-4 rounded-xl border border-arch-border-subtle bg-arch-surface-base shadow-sm hover:shadow-card transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-2 rounded-lg ${
                          item.status === 'operational'
                            ? 'bg-accent-green/10 text-accent-green'
                            : item.status === 'breakdown'
                              ? 'bg-accent-red/10 text-accent-red'
                              : 'bg-accent-orange/10 text-accent-orange'
                        }`}
                      >
                        {renderIcon(item.category)}
                      </div>
                      <div>
                        <p className="text-sm font-bold font-mono text-arch-text-primary">
                          {item.code}
                        </p>
                        <p className="text-xs text-arch-text-muted capitalize">{item.category}</p>
                      </div>
                    </div>
                    {item.status === 'operational' && (
                      <CheckCircle2 className="w-4 h-4 text-accent-green" />
                    )}
                    {item.status === 'breakdown' && (
                      <ShieldAlert className="w-4 h-4 text-accent-red" />
                    )}
                    {item.status === 'maintenance' && (
                      <BadgeAlert className="w-4 h-4 text-accent-orange" />
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-arch-border-subtle mt-1">
                    <div className="text-xs font-medium text-arch-text-secondary font-mono">
                      {item.hour_meter.toLocaleString()} SMU
                    </div>
                    <button
                      type="button"
                      disabled={isPending || item.status === 'breakdown'}
                      onClick={() => handleReportBreakdown(item.id, item.code)}
                      className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${
                        item.status === 'breakdown'
                          ? 'bg-arch-surface-secondary text-arch-text-muted cursor-not-allowed'
                          : 'bg-accent-red/10 text-accent-red hover:bg-accent-red/20 cursor-pointer active:scale-95'
                      }`}
                    >
                      {item.status === 'breakdown' ? 'Down' : 'Report Breakdown'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
