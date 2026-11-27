// cspell:ignore googlegemini githubcopilot
'use client';

import { cn } from '@repo/ui/lib/utils';
import { useState } from 'react';

interface AgentProvider {
  name: string;
  logo?: string;
  monogram: string;
}

// Official wordmark glyphs are sourced from Simple Icons (CC0) into
// public/logos/agents. Providers without a published glyph fall back to a
// neutral monogram chip instead of an invented logo.
const PROVIDERS: readonly AgentProvider[] = [
  { name: 'Google Antigravity', monogram: 'AG' },
  { name: 'Claude', logo: '/logos/agents/anthropic.svg', monogram: 'CL' },
  { name: 'Gemini', logo: '/logos/agents/googlegemini.svg', monogram: 'GM' },
  { name: 'OpenAI Codex', logo: '/logos/agents/openai.svg', monogram: 'OA' },
  { name: 'Cursor', logo: '/logos/agents/cursor.svg', monogram: 'CU' },
  { name: 'GitHub Copilot', logo: '/logos/agents/githubcopilot.svg', monogram: 'GH' },
  { name: 'Windsurf', logo: '/logos/agents/windsurf.svg', monogram: 'WS' },
  { name: 'Cline', logo: '/logos/agents/cline.svg', monogram: 'CN' },
  { name: 'Qoder', monogram: 'QD' },
];

function ProviderMark({ provider, muted = false }: { provider: AgentProvider; muted?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showLogo = provider.logo && !failed;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/[0.07] bg-white/75 px-2 py-0.5 shadow-2xs backdrop-blur-sm',
        muted && 'opacity-90'
      )}
    >
      {showLogo ? (
        <img
          src={provider.logo}
          alt=""
          aria-hidden="true"
          width={14}
          height={14}
          loading="lazy"
          decoding="async"
          className="h-3.5 w-3.5 shrink-0 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-slate-900 font-bold text-[6.5px] text-white leading-none"
        >
          {provider.monogram}
        </span>
      )}
      <span className="whitespace-nowrap font-medium text-[10.5px] text-zinc-700 leading-none">
        {provider.name}
      </span>
    </span>
  );
}

function ProviderGroup({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden ? 'true' : undefined}
      className="flex shrink-0 items-center gap-1.5 pr-1.5"
    >
      {PROVIDERS.map((provider) => (
        <li key={provider.name}>
          <ProviderMark provider={provider} muted={ariaHidden} />
        </li>
      ))}
    </ul>
  );
}

export function AgentProviderMarquee() {
  return (
    <div
      data-testid="agent-provider-marquee"
      aria-label="Powered by coding agent providers"
      className="group/marquee flex items-center gap-2"
    >
      <span className="shrink-0 font-semibold text-[10.5px] text-zinc-600 uppercase tracking-wider">
        Powered by :
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
        <div className="flex w-max items-center motion-safe:animate-[agent-marquee_46s_linear_infinite] motion-reduce:animate-none group-focus-within/marquee:[animation-play-state:paused] group-hover/marquee:[animation-play-state:paused]">
          <ProviderGroup />
          <ProviderGroup ariaHidden />
        </div>
      </div>
      <span className="sr-only">
        Providers: {PROVIDERS.map((provider) => provider.name).join(', ')}
      </span>
    </div>
  );
}
