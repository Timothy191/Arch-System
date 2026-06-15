"use client";

import { useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { PrecisionInput } from "@/components/ui/PrecisionInput";
import { Activity, RotateCcw } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-arch-accent-green" />
          <h3 className="text-[var(--text-heading)] font-medium">
            Operational Parameters
          </h3>
        </div>
        {lastApplied && (
          <span className="text-[10px] text-[var(--text-muted)]">
            Applied at {lastApplied}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-emphasis)]">
        <Button
          variant="outline"
          onClick={handleReset}
          className="border-[var(--border-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset Defaults
        </Button>
        <Button
          onClick={handleApply}
          className="bg-arch-accent-green text-white hover:bg-arch-accent-green/90 font-medium"
        >
          Apply Configuration
        </Button>
      </div>
    </GlassCard>
  );
}
