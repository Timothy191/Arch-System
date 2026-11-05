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
      eagerness: 'moderate',
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

/**
 * Browser Speculation Rules API (`<script type="speculationrules">`)
 * Prerenders and prefetches high-probability department and hub routes
 * on hover/pointerdown (`eagerness: "moderate"`) for near-0ms LCP navigation.
 */
export function SpeculationRules(): React.JSX.Element {
  return (
    <script type="speculationrules" dangerouslySetInnerHTML={{ __html: SPECULATION_RULES_JSON }} />
  );
}
