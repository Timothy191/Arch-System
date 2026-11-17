import { GlassCard } from '@repo/ui/components/GlassCard';
import { Divider } from '@repo/ui/Divider';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CloudflareInfrastructureConsole } from '@/components/cloudflare/CloudflareInfrastructureConsole';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { ControlRoomQuickNav } from '../components/ControlRoomQuickNav';
import { ControlRoomSubtabs } from '../components/ControlRoomSubtabs';

export const metadata: Metadata = {
  title: 'Cloudflare Edge Security | Control Room | Arch OS',
  description:
    'Read-only Cloudflare Zero Trust, Tunnel, Workers, Queues, Turnstile, AI Gateway, R2, and WAF status for the Control Room.',
};

function CloudflareEdgeSkeleton() {
  return (
    <GlassCard className="max-w-5xl animate-pulse p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-64 rounded-md bg-[var(--bg-secondary)]" />
          <div className="h-4 w-96 rounded-md bg-[var(--bg-secondary)]/60" />
        </div>
      </div>
      <div className="mb-4 h-10 w-48 rounded-lg bg-[var(--bg-secondary)]" />
      <div className="h-64 w-full rounded-xl bg-[var(--bg-secondary)]/40" />
    </GlassCard>
  );
}

export default function ControlRoomCloudflareEdgePage() {
  return (
    <ErrorBoundary context="Control Room Cloudflare Edge Security">
      <div className="space-y-6">
        <GlassCard hover accent="charcoal">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Link
                  href="/control-room"
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] text-xs transition-colors hover:text-[var(--text-heading)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Control Room
                </Link>
              </div>
              <h1 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                Cloudflare Infrastructure &amp; Edge Security Centre
              </h1>
              <p className="mt-1 text-[var(--text-secondary)] text-sm">
                Read-only Zero Trust, Tunnel, Workers, Queues, Turnstile, AI Gateway, R2 &amp; WAF
                status. No plant-control actions are exposed here.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <ControlRoomQuickNav />
            </div>
          </div>

          <ControlRoomSubtabs activeTab="cloudflare-edge" />
        </GlassCard>

        <Divider variant="dotted" label="EDGE SECURITY & INFRASTRUCTURE STATUS" />

        <Suspense fallback={<CloudflareEdgeSkeleton />}>
          <CloudflareInfrastructureConsole />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
