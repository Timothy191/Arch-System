import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { ControlRoomQuickNav } from '../components/ControlRoomQuickNav';
import { ControlRoomSubtabs } from '../components/ControlRoomSubtabs';
import { QualityIntelligenceConsole } from './QualityIntelligenceConsole';

export const metadata: Metadata = {
  title: 'Quality Intelligence | Control Room | Arch OS',
  description:
    'Deterministic quality gates, 8-category weighted scoring, agent verification reports, regression detection, and release certification for Arch OS.',
};

const BACK_LINK_CLASS =
  'inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] text-xs transition-colors hover:text-[var(--text-heading)]';

const SKELETON_BLOCK_CLASS = 'rounded-lg bg-[var(--bg-secondary)]';

function QualityIntelligenceSkeleton() {
  return (
    <GlassCard className="max-w-7xl animate-pulse p-6">
      <div className="mb-6 space-y-2">
        <div className={`h-6 w-64 ${SKELETON_BLOCK_CLASS}`} />
        <div className={`h-4 w-96 ${SKELETON_BLOCK_CLASS}`} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className={`h-24 ${SKELETON_BLOCK_CLASS}`} />
        <div className={`h-24 ${SKELETON_BLOCK_CLASS}`} />
        <div className={`h-24 ${SKELETON_BLOCK_CLASS}`} />
        <div className={`h-24 ${SKELETON_BLOCK_CLASS}`} />
      </div>
      <div className={`mt-6 h-64 w-full ${SKELETON_BLOCK_CLASS}`} />
    </GlassCard>
  );
}

export default function ControlRoomQualityIntelligencePage() {
  return (
    <ErrorBoundary context="Control Room Quality Intelligence">
      <div className="space-y-6">
        <GlassCard hover accent="charcoal">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Link href="/control-room" className={BACK_LINK_CLASS}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Control Room
                </Link>
              </div>
              <h1 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                Quality Intelligence &amp; Release Certification
              </h1>
              <p className="mt-1 text-[var(--text-secondary)] text-sm">
                Independent verification evidence, 8-category quality scoring, agent diff audits,
                regression alerts, and release readiness gates.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <ControlRoomQuickNav />
            </div>
          </div>

          <ControlRoomSubtabs activeTab="quality-intelligence" />
        </GlassCard>

        <Divider variant="dotted" label="QUALITY INTELLIGENCE ENGINE" />

        <Suspense fallback={<QualityIntelligenceSkeleton />}>
          <QualityIntelligenceConsole />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
