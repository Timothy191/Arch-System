'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  ChevronDown,
  FileSpreadsheet,
  LifeBuoy,
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

const ACTION_ITEMS = [
  {
    href: '/access-control/access-logs',
    icon: Zap,
    label: 'Access Logs & Register',
    color: 'text-amber-600',
  },
  {
    href: '/access-control/print-cards',
    icon: Printer,
    label: 'Print Badge (Neo300)',
    color: 'text-blue-600',
  },
  {
    href: '/access-control/visitors',
    icon: UserPlus,
    label: 'Enroll Visitor',
    color: 'text-teal-600',
  },
  {
    href: '/access-control/qr-codes',
    icon: QrCode,
    label: 'RFID Inventory',
    color: 'text-purple-600',
  },
  {
    href: '/access-control/muster',
    icon: LifeBuoy,
    label: 'On-Site Roll Call',
    color: 'text-red-600',
  },
  {
    href: '/access-control/reports',
    icon: FileSpreadsheet,
    label: 'Regulatory Pack',
    color: 'text-emerald-600',
  },
] as const;

export function QuickActionHub() {
  const [pulseLoading, setPulseLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleFastGatePulse = async () => {
    try {
      setPulseLoading(true);
      const res = await triggerGatePulse('Main Gate', 'Manual Gate Override from SOC Hub');
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
        {/* Left: Header with separator */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
              Security Operations Command
            </h4>
            {/* Separator under header */}
            <div className="mt-1 h-0.5 w-full rounded bg-[var(--accent-blue)]/30" />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Rapid physical barrier dispatch, credential issuance &amp; muster triggers
            </p>
          </div>
        </div>

        {/* Right: Interactive Dropdown + Pulse Button */}
        <div className="flex w-full items-center gap-2 lg:w-auto">
          {/* Dropdown for actions */}
          <div className="relative flex-1 lg:flex-none">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--accent-blue)]/30 bg-white px-3 py-1.5 font-bold text-[var(--text-heading)] text-xs shadow-2xs transition-all hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] active:scale-95 lg:w-auto"
            >
              <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              <span>Quick Actions</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-lg border border-[var(--border-default)] bg-white shadow-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  }
                }}
              >
                {ACTION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 border-[var(--border-default)] border-b px-3 py-2 font-semibold text-[var(--text-heading)] text-xs transition-colors first:rounded-t-lg last:rounded-b-lg last:border-0 hover:bg-[var(--bg-secondary)]"
                    >
                      <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Gate Override Pulse */}
          <button
            type="button"
            onClick={handleFastGatePulse}
            disabled={pulseLoading}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-800 text-xs transition-all hover:bg-amber-500 hover:text-white active:scale-95"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{pulseLoading ? 'Logging...' : 'Log Gate Override'}</span>
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
