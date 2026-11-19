'use client';

import { type CloudflareConnectionMode, cloudflareSummaryResponseSchema } from '@repo/contract';
import { GlassCard } from '@repo/ui/GlassCard';
import { useQuery } from '@tanstack/react-query';

const MODE_BADGE_MAP: Record<CloudflareConnectionMode, { label: string; className: string }> = {
  live: {
    label: 'Live',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  fallback: {
    label: 'Metrics unavailable',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  unconfigured: {
    label: 'Not connected',
    className: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  },
  insufficient: {
    label: 'Insufficient permissions',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

async function fetchCloudflareSummary() {
  const response = await fetch('/api/cloudflare/summary', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch Cloudflare summary');
  }
  const data = await response.json();
  return cloudflareSummaryResponseSchema.parse(data);
}

export function CloudflarePanel() {
  const summaryQuery = useQuery({
    queryKey: ['cloudflare', 'hub-panel'],
    queryFn: fetchCloudflareSummary,
  });

  const summary = summaryQuery.data;

  if (!summary) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-zinc-600">Loading Cloudflare status...</p>
      </GlassCard>
    );
  }

  const modeBadges = {
    account: MODE_BADGE_MAP[summary.account.mode],
    zeroTrust: MODE_BADGE_MAP[summary.zeroTrust.mode],
    tunnel: MODE_BADGE_MAP[summary.tunnel.mode],
    workers: MODE_BADGE_MAP[summary.workers.mode],
    queues: MODE_BADGE_MAP[summary.queues.mode],
    turnstile: MODE_BADGE_MAP[summary.turnstile.mode],
    aiGateway: summary.aiGateway.mode !== 'live' ? 'Not configured' : 'Active',
    r2: summary.r2.mode !== 'live' ? 'Not configured' : 'Buckets available',
    securityCentre: MODE_BADGE_MAP[summary.securityCentre.mode],
  };

  return (
    <GlassCard className="space-y-4 p-6">
      <h2 className="font-semibold text-zinc-900">Cloudflare Infrastructure</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-500">Account</p>
          <span
            className={`rounded-full border px-2 py-0.5 font-medium text-[10px] ${modeBadges.account.className}`}
          >
            {modeBadges.account.label}
          </span>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Zero Trust</p>
          <span
            className={`rounded-full border px-2 py-0.5 font-medium text-[10px] ${modeBadges.zeroTrust.className}`}
          >
            {modeBadges.zeroTrust.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-500">Tunnel</p>
          <span
            className={`rounded-full border px-2 py-0.5 font-medium text-[10px] ${modeBadges.tunnel.className}`}
          >
            {modeBadges.tunnel.label}
          </span>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Workers</p>
          <span
            className={`rounded-full border px-2 py-0.5 font-medium text-[10px] ${modeBadges.workers.className}`}
          >
            {modeBadges.workers.label}
          </span>
        </div>
      </div>

      <div>
        <p className="text-xs text-zinc-500">Queues</p>
        <span
          className={`rounded-full border px-2 py-0.5 font-medium text-[10px] ${modeBadges.queues.className}`}
        >
          {modeBadges.queues.label}
        </span>
      </div>

      <div>
        <p className="text-xs text-zinc-500">Turnstile</p>
        <span
          className={`rounded-full border px-2 py-0.5 font-medium text-[10px] ${modeBadges.turnstile.className}`}
        >
          {modeBadges.turnstile.label}
        </span>
      </div>

      {summary.aiGateway.featureEnabled && (
        <div>
          <p className="text-xs text-zinc-500">AI Gateway</p>
          <span className="text-sm text-zinc-900">Active</span>
        </div>
      )}
      {!summary.aiGateway.featureEnabled && (
        <div>
          <p className="text-xs text-zinc-500">AI Gateway</p>
          <span className="text-amber-600 text-sm">Not configured</span>
        </div>
      )}

      {summary.r2.mode === 'live' && (
        <div>
          <p className="text-xs text-zinc-500">R2</p>
          <span className="text-sm text-zinc-900">Buckets available</span>
        </div>
      )}
      {summary.r2.mode !== 'live' && (
        <div>
          <p className="text-xs text-zinc-500">R2</p>
          <span className="text-amber-600 text-sm">Not configured</span>
        </div>
      )}

      <div>
        <p className="text-xs text-zinc-500">Security Centre</p>
        <span
          className={`rounded-full border px-2 py-0.5 font-medium text-[10px] ${modeBadges.securityCentre.className}`}
        >
          {modeBadges.securityCentre.label}
        </span>
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        Generated {new Date(summary.generatedAt).toLocaleString('en-ZA')}
      </div>
    </GlassCard>
  );
}
