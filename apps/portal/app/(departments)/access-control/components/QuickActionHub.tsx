'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  CreditCard,
  FileSpreadsheet,
  LifeBuoy,
  Plus,
  Printer,
  QrCode,
  ShieldCheck,
  UserPlus,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { triggerGatePulse } from '../actions';

export function QuickActionHub() {
  const [pulseLoading, setPulseLoading] = useState(false);

  const handleFastGatePulse = async () => {
    try {
      setPulseLoading(true);
      const res = await triggerGatePulse(
        'Main Gate Inbound Boom',
        'Emergency Quick-Pulse from SOC Hub'
      );
      toast.success(res.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gate pulse failed';
      toast.error(message);
    } finally {
      setPulseLoading(false);
    }
  };

  return (
    <GlassCard variant="window" className="p-4">
      <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
              Security Operations Command
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              Rapid physical barrier dispatch, credential issuance & muster triggers
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          {/* Action 1: Print Badge */}
          <Link
            href="/access-control/print-cards"
            className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-all hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] active:scale-95"
          >
            <Printer className="h-3.5 w-3.5 text-blue-600" />
            <span>Print Badge (Neo300)</span>
          </Link>

          {/* Action 2: Enroll Visitor */}
          <Link
            href="/access-control/visitors"
            className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-all hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] active:scale-95"
          >
            <UserPlus className="h-3.5 w-3.5 text-teal-600" />
            <span>Enroll Visitor</span>
          </Link>

          {/* Action 3: QR & RFID Studio */}
          <Link
            href="/access-control/qr-codes"
            className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-all hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] active:scale-95"
          >
            <QrCode className="h-3.5 w-3.5 text-purple-600" />
            <span>RFID Inventory</span>
          </Link>

          {/* Action 4: Muster Station */}
          <Link
            href="/access-control/muster"
            className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-all hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] active:scale-95"
          >
            <LifeBuoy className="h-3.5 w-3.5 text-red-600" />
            <span>Muster Roll</span>
          </Link>

          {/* Action 5: Regulatory Reports */}
          <Link
            href="/access-control/reports"
            className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-all hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] active:scale-95"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Regulatory Pack</span>
          </Link>

          {/* Action 6: Quick Gate Override Pulse */}
          <button
            type="button"
            onClick={handleFastGatePulse}
            disabled={pulseLoading}
            className="gold-steel-border gold-steel-border-slim ml-auto flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-800 text-xs transition-all hover:bg-amber-500 hover:text-white active:scale-95 sm:ml-0"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{pulseLoading ? 'Pulsing...' : 'Override Pulse'}</span>
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
