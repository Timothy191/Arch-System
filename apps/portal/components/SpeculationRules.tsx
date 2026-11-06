import type React from 'react';

const SPECULATED_ROUTE_PATTERNS = [
  '/hub',
  '/hub/*',
  '/drilling',
  '/drilling/*',
  '/production',
  '/production/*',
  '/plant-processing',
  '/plant-processing/*',
  '/plant-inventory',
  '/plant-inventory/*',
  '/access-control',
  '/access-control/*',
  '/engineering',
  '/engineering/*',
  '/control-room',
  '/control-room/*',
  '/availability-utilization',
  '/availability-utilization/*',
  '/office',
  '/office/*',
  '/overview',
  '/overview/*',
] as const;

const EXCLUDED_ROUTE_PATTERNS = ['/login*', '/api/*', '/admin*'] as const;

export const SPECULATION_RULES_PAYLOAD = {
  prerender: [
    {
      where: {
        and: [
          { href_matches: SPECULATED_ROUTE_PATTERNS },
          { not: { href_matches: EXCLUDED_ROUTE_PATTERNS } },
          { not: { selector_matches: '[rel~=nofollow], [data-no-speculate]' } },
        ],
      },
      // Two-tier speculation: prerender on pointerdown ('conservative') to avoid wasted
      // headless-tab RAM on casual cursor sweeps while preserving 0ms navigation on click.
      eagerness: 'conservative',
    },
  ],
  prefetch: [
    {
      where: {
        and: [
          { href_matches: SPECULATED_ROUTE_PATTERNS },
          { not: { href_matches: EXCLUDED_ROUTE_PATTERNS } },
        ],
      },
      eagerness: 'moderate',
    },
  ],
} as const;

export const SPECULATION_RULES_JSON = JSON.stringify(SPECULATION_RULES_PAYLOAD);

export interface SpeculationRulesProps {
  nonce?: string;
}

/**
 * Browser Speculation Rules API (`<script type="speculationrules">`)
 * Prerenders and prefetches high-probability department and hub routes
 * on hover/pointerdown (`eagerness: "moderate"`) for near-0ms LCP navigation.
 */
export function SpeculationRules({ nonce }: SpeculationRulesProps = {}): React.JSX.Element {
  return (
    <script
      type="speculationrules"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: SPECULATION_RULES_JSON }}
    />
  );
}
