'use client';

import { AnimatedDialog } from '@repo/ui';
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
  const [breakdownTarget, setBreakdownTarget] = useState<FleetItem | null>(null);
  const [isSubmittingBreakdown, setIsSubmittingBreakdown] = useState(false);

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
    setIsSubmittingBreakdown(true);
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
      } finally {
        setIsSubmittingBreakdown(false);
        setBreakdownTarget(null);
      }
    });
  };

  const renderIcon = (category: string) => {
    switch (category) {
      case 'truck':
        return <Truck className="h-5 w-5" />;
      case 'excavator':
        return <Factory className="h-5 w-5" />;
      default:
        return <Map className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-arch-text-primary text-xl">Live Equipment Map & Data Grid</h3>
        {actionMessage && (
          <span className="fade-in animate-in rounded-full bg-arch-brand-blue/10 px-3 py-1 font-semibold text-arch-brand-blue text-xs">
            {actionMessage}
          </span>
        )}
      </div>

      <GlassCard variant="spotlight" className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-arch-border-subtle border-b bg-arch-surface-secondary/50 p-5">
          <h4 className="font-semibold text-arch-text-primary text-sm">Active Pit Assets</h4>
          <div className="flex gap-4 font-medium text-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-green" /> Operational
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeAlert className="h-3.5 w-3.5 text-accent-orange" /> Maintenance
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-accent-red" /> Breakdown
            </span>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-arch-brand-blue" />
            </div>
          ) : fleet.length === 0 ? (
            <div className="flex h-48 items-center justify-center font-medium text-arch-text-muted text-sm">
              No equipment data found for this department.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {fleet.map((item: FleetItem) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-arch-border-subtle bg-arch-surface-base p-4 shadow-sm transition-all hover:shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`rounded-lg p-2 ${
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
                        <p className="font-bold font-mono text-arch-text-primary text-sm">
                          {item.code}
                        </p>
                        <p className="text-arch-text-muted text-xs capitalize">{item.category}</p>
                      </div>
                    </div>
                    {item.status === 'operational' && (
                      <CheckCircle2 className="h-4 w-4 text-accent-green" />
                    )}
                    {item.status === 'breakdown' && (
                      <ShieldAlert className="h-4 w-4 text-accent-red" />
                    )}
                    {item.status === 'maintenance' && (
                      <BadgeAlert className="h-4 w-4 text-accent-orange" />
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between border-arch-border-subtle border-t pt-3">
                    <div className="font-medium font-mono text-arch-text-secondary text-xs">
                      {item.hour_meter.toLocaleString()} SMU
                    </div>
                    <button
                      type="button"
                      disabled={isPending || isSubmittingBreakdown || item.status === 'breakdown'}
                      onClick={() => setBreakdownTarget(item)}
                      className={`flex h-[44px] min-h-[44px] items-center justify-center rounded-lg px-4 py-2 font-semibold text-xs transition-all ${
                        item.status === 'breakdown'
                          ? 'cursor-not-allowed bg-arch-surface-secondary text-arch-text-muted'
                          : 'cursor-pointer bg-accent-red/10 text-accent-red hover:bg-accent-red/20 active:scale-95'
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

      {/* Confirmation Modal before Dispatching Breakdown Escalation */}
      <AnimatedDialog
        open={Boolean(breakdownTarget)}
        onClose={() => !isSubmittingBreakdown && setBreakdownTarget(null)}
        title="Confirm Breakdown Escalation"
        description="Escalating an equipment breakdown notifies the engineering and dispatch teams immediately and marks this asset as down."
        className="max-w-md"
      >
        <div className="mt-2 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-accent-red/20 bg-accent-red/10 p-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" />
            <div className="space-y-1">
              <p className="font-semibold text-arch-text-primary text-xs">
                Report line-down event for {breakdownTarget?.code}?
              </p>
              <p className="text-arch-text-secondary text-xs">
                Asset: <span className="font-medium font-mono">{breakdownTarget?.code}</span> (
                <span className="capitalize">{breakdownTarget?.category}</span>) &bull; SMU:{' '}
                <span className="font-mono">{breakdownTarget?.hour_meter?.toLocaleString()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmittingBreakdown}
              onClick={() => setBreakdownTarget(null)}
              className="rounded-lg border border-arch-border-subtle px-4 py-2 font-medium text-arch-text-secondary text-xs transition-colors hover:bg-arch-surface-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingBreakdown}
              onClick={() => {
                if (breakdownTarget) {
                  handleReportBreakdown(breakdownTarget.id, breakdownTarget.code);
                }
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-accent-red px-4 py-2 font-semibold text-white text-xs shadow-sm transition-all hover:bg-accent-red/90"
            >
              {isSubmittingBreakdown ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Confirm Breakdown</span>
                </>
              )}
            </button>
          </div>
        </div>
      </AnimatedDialog>
    </div>
  );
}
