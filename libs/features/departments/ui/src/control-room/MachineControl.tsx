'use client';

import { Button } from '@repo/ui/components/ui/button';
import { PrecisionInput } from '@repo/ui/components/ui/PrecisionInput';
import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, RotateCcw } from 'lucide-react';
import { useState } from 'react';

export function MachineControl() {
  const [rpm, setRpm] = useState<number | null>(1250);
  const [power, setPower] = useState<number | null>(85);
  const [pressure, setPressure] = useState<number | null>(420);
  const [lastApplied, setLastApplied] = useState<string | null>(null);

  const handleApply = () => {
    setLastApplied(new Date().toLocaleTimeString());
  };

  const handleReset = () => {
    setRpm(1250);
    setPower(85);
    setPressure(420);
    setLastApplied(null);
  };

  return (
    <GlassCard className="mt-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-arch-accent-green" />
          <h3 className="font-medium text-[var(--text-heading)]">Operational Parameters</h3>
        </div>
        {lastApplied && (
          <span className="text-[10px] text-[var(--text-muted)]">Applied at {lastApplied}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4">
          <PrecisionInput
            label="Target Rotation Speed"
            suffix="RPM"
            value={rpm}
            onChange={(_, val) => setRpm(val)}
            min={0}
            max={5000}
            step={50}
          />
        </div>

        <div className="space-y-4">
          <PrecisionInput
            label="Power Allocation"
            suffix="%"
            value={power}
            onChange={(_, val) => setPower(val)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        <div className="space-y-4">
          <PrecisionInput
            label="Hydraulic Pressure"
            suffix="PSI"
            value={pressure}
            onChange={(_, val) => setPressure(val)}
            min={0}
            max={1000}
            step={5}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3 border-[var(--border-emphasis)] border-t pt-6">
        <Button
          variant="outline"
          onClick={handleReset}
          className="border-[var(--border-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Defaults
        </Button>
        <Button
          onClick={handleApply}
          className="bg-arch-accent-green font-medium text-white hover:bg-arch-accent-green/90"
        >
          Apply Configuration
        </Button>
      </div>
    </GlassCard>
  );
}
