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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-heading)]">
              Security Operations Command
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              Rapid physical barrier dispatch, credential issuance & muster triggers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Action 1: Print Badge */}
          <Link
            href="/access-control/print-cards"
            className="flex items-center gap-1.5 bg-white border border-black/[0.08] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] text-[var(--text-heading)] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            <span>Print Badge (Neo300)</span>
          </Link>

          {/* Action 2: Enroll Visitor */}
          <Link
            href="/access-control/visitors"
            className="flex items-center gap-1.5 bg-white border border-black/[0.08] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] text-[var(--text-heading)] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5 text-teal-600" />
            <span>Enroll Visitor</span>
          </Link>

          {/* Action 3: QR & RFID Studio */}
          <Link
            href="/access-control/qr-codes"
            className="flex items-center gap-1.5 bg-white border border-black/[0.08] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] text-[var(--text-heading)] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <QrCode className="w-3.5 h-3.5 text-purple-600" />
            <span>RFID Inventory</span>
          </Link>

          {/* Action 4: Muster Station */}
          <Link
            href="/access-control/muster"
            className="flex items-center gap-1.5 bg-white border border-black/[0.08] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] text-[var(--text-heading)] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-red-600" />
            <span>Muster Roll</span>
          </Link>

          {/* Action 5: Regulatory Reports */}
          <Link
            href="/access-control/reports"
            className="flex items-center gap-1.5 bg-white border border-black/[0.08] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] text-[var(--text-heading)] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Regulatory Pack</span>
          </Link>

          {/* Action 6: Quick Gate Override Pulse */}
          <button
            type="button"
            onClick={handleFastGatePulse}
            disabled={pulseLoading}
            className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500 hover:text-white text-amber-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ml-auto sm:ml-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{pulseLoading ? 'Pulsing...' : 'Override Pulse'}</span>
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
