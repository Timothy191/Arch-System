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
      className="relative overflow-hidden border-l-4 border-l-[var(--accent-blue)] p-4 sm:p-5"
    >
      <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
        {/* Left: Real-Time Headcount & Status */}
        <div className="flex items-start gap-4 sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded bg-[var(--accent-blue)]/10 px-2 py-0.5 font-mono font-semibold text-[var(--accent-blue)] text-xs uppercase tracking-wider">
                LIVE SOC TELEMETRY
              </span>
              <div className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)] text-xs">
                <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                <span>Brakfontein Pit & Surface Facilities</span>
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 className="font-extrabold font-mono text-3xl text-[var(--text-heading)] tracking-tight">
                {totalSouls}{' '}
                <span className="font-medium font-sans text-[var(--text-muted)] text-sm">
                  Souls On-Site
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Center: Breakdown Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-1.5 font-medium text-[var(--text-secondary)]">
            <HardHat className="h-3.5 w-3.5 text-blue-600" />
            <span>Personnel:</span>
            <strong className="font-mono text-[var(--text-heading)]">{employeesCount}</strong>
          </div>
          <div className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-1.5 font-medium text-[var(--text-secondary)]">
            <Shield className="h-3.5 w-3.5 text-amber-600" />
            <span>Contractors:</span>
            <strong className="font-mono text-[var(--text-heading)]">{contractorsCount}</strong>
          </div>
          <div className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-1.5 font-medium text-[var(--text-secondary)]">
            <Users className="h-3.5 w-3.5 text-teal-600" />
            <span>Visitors:</span>
            <strong className="font-mono text-[var(--text-heading)]">{visitorsCount}</strong>
          </div>
          <div className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-1.5 font-medium text-[var(--text-secondary)]">
            <Truck className="h-3.5 w-3.5 text-indigo-600" />
            <span>Fleet / Trucks:</span>
            <strong className="font-mono text-[var(--text-heading)]">{vehiclesCount}</strong>
          </div>
        </div>

        {/* Right: Blast Status & Muster Action */}
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <div className="hidden text-right sm:block">
            <div className="flex items-center justify-end gap-1.5">
              {isEmergency ? (
                <AlertTriangle className="h-4 w-4 animate-bounce text-red-600" />
              ) : isStandby ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <span
                className={`font-bold text-xs uppercase tracking-wider ${
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
            <p className="font-mono text-[11px] text-[var(--text-muted)]">
              Pit Bench 04 • Next Roll: 14:00
            </p>
          </div>

          <Link
            href="/access-control/muster"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-bold text-white text-xs shadow-sm transition-all hover:bg-[var(--accent-blue)]/90 active:scale-95"
          >
            <LifeBuoy className="h-4 w-4" />
            <span>Muster Roll Call</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
