'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HardHat,
  LifeBuoy,
  Radio,
  Shield,
  Truck,
  Users,
} from 'lucide-react';
import Link from 'next/link';

interface HeadcountMusterBannerProps {
  totalSouls?: number;
  employeesCount?: number;
  contractorsCount?: number;
  visitorsCount?: number;
  vehiclesCount?: number;
  blastStatus?: 'ALL_CLEAR' | 'STANDBY_BLAST_SCHEDULED' | 'MUSTER_EVACUATION_ACTIVE';
}

export function HeadcountMusterBanner({
  totalSouls = 142,
  employeesCount = 88,
  contractorsCount = 42,
  visitorsCount = 12,
  vehiclesCount = 34,
  blastStatus = 'ALL_CLEAR',
}: HeadcountMusterBannerProps) {
  const isEmergency = blastStatus === 'MUSTER_EVACUATION_ACTIVE';
  const isStandby = blastStatus === 'STANDBY_BLAST_SCHEDULED';

  return (
    <GlassCard
      variant="window"
      className="p-4 sm:p-5 border-l-4 border-l-[var(--accent-blue)] relative overflow-hidden"
    >
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        {/* Left: Real-Time Headcount & Status */}
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center shrink-0 border border-[var(--accent-blue)]/20">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-2 py-0.5 rounded">
                LIVE SOC TELEMETRY
              </span>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Brakfontein Pit & Surface Facilities</span>
              </div>
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <h2 className="text-3xl font-extrabold text-[var(--text-heading)] font-mono tracking-tight">
                {totalSouls}{' '}
                <span className="text-sm font-sans font-medium text-[var(--text-muted)]">
                  Souls On-Site
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Center: Breakdown Pills */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 bg-black/[0.03] border border-black/[0.08] px-3 py-1.5 rounded-lg font-medium text-[var(--text-secondary)]">
            <HardHat className="w-3.5 h-3.5 text-blue-600" />
            <span>Personnel:</span>
            <strong className="font-mono text-[var(--text-heading)]">{employeesCount}</strong>
          </div>
          <div className="flex items-center gap-1.5 bg-black/[0.03] border border-black/[0.08] px-3 py-1.5 rounded-lg font-medium text-[var(--text-secondary)]">
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>Contractors:</span>
            <strong className="font-mono text-[var(--text-heading)]">{contractorsCount}</strong>
          </div>
          <div className="flex items-center gap-1.5 bg-black/[0.03] border border-black/[0.08] px-3 py-1.5 rounded-lg font-medium text-[var(--text-secondary)]">
            <Users className="w-3.5 h-3.5 text-teal-600" />
            <span>Visitors:</span>
            <strong className="font-mono text-[var(--text-heading)]">{visitorsCount}</strong>
          </div>
          <div className="flex items-center gap-1.5 bg-black/[0.03] border border-black/[0.08] px-3 py-1.5 rounded-lg font-medium text-[var(--text-secondary)]">
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Fleet / Trucks:</span>
            <strong className="font-mono text-[var(--text-heading)]">{vehiclesCount}</strong>
          </div>
        </div>

        {/* Right: Blast Status & Muster Action */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1.5 justify-end">
              {isEmergency ? (
                <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
              ) : isStandby ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isEmergency ? 'text-red-600' : isStandby ? 'text-amber-600' : 'text-emerald-700'
                }`}
              >
                {isEmergency
                  ? 'Muster Evacuation Active'
                  : isStandby
                    ? 'Blast Window Scheduled'
                    : 'Clearance: All Clear'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono">
              Pit Bench 04 • Next Roll: 14:00
            </p>
          </div>

          <Link
            href="/access-control/muster"
            className="flex items-center gap-2 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
          >
            <LifeBuoy className="w-4 h-4" />
            <span>Muster Roll Call</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
