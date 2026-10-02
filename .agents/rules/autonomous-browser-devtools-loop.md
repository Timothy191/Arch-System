---
name: autonomous-browser-devtools-loop
description: Mandates closed-loop agent engineering with Playwright, Puppeteer, Chrome DevTools Protocol (CDP), and Lighthouse for autonomous UI, performance, and accessibility verification in Arch-System.
paths:
  - 'apps/portal/app/**'
  - 'apps/portal/components/**'
  - 'libs/features/**'
  - 'packages/ui/**'
  - 'e2e/**'
---

# Autonomous Browser & DevTools Closed-Loop Verification

## 1. Closed-Loop Agent Engineering Mandate

Following autonomous loop engineering principles (`cobusgreyling/loop-engineering`):
Any agent working on UI, navigation, accessibility, or page performance MUST execute a closed-loop verification cycle before declaring work complete:

1. **Sense:** Probe the target route on local dev (`http://localhost:3000`) or production (`https://arch-system-theta.vercel.app`) using Playwright or Puppeteer MCP. Inspect the DOM, network waterfall, and console logs.
2. **Diagnose:** Evaluate Core Web Vitals, Speed Index, ARIA landmark semantics, color contrast ratios (WCAG AA ≥ 4.5:1), and touch target dimensions (≥ 24px minimum, ≥ 32px-44px recommended).
3. **Remediate:** Implement necessary code modifications (lazy-loading, dynamic imports with `ssr: false`, semantic HTML tags, contrast adjustments).
4. **Evaluate:** Run Playwright accessibility suites (`pnpm test:e2e` or `e2e/accessibility.spec.ts`) and Lighthouse CLI audits (`lighthouse <url> --chrome-flags="--headless"`).
5. **Self-Heal:** Autonomously correct any discovered regressions without pausing or interrupting the user.

## 2. Toolchain Reference & Standards

- **Playwright (`microsoft/playwright`):**
  - Config: `e2e/playwright.config.ts`.
  - Accessibility tests: `e2e/accessibility.spec.ts` using `axe-playwright`.
  - Web Vitals tests: `e2e/web-vitals.spec.ts`.
  - Run command: `pnpm --filter portal exec playwright test --config=../../e2e/playwright.config.ts`.
- **Puppeteer & Chrome DevTools Protocol (`puppeteer/puppeteer`, `ChromeDevTools/chrome-devtools-mcp`):**
  - Used for rapid headless DOM state extraction, screenshots, and CDP console/network evaluation.
- **Lighthouse CLI (`GoogleChrome/lighthouse`):**
  - Run command: `lighthouse http://localhost:3000/login --chrome-flags="--headless" --output json --output-path=./temp/lighthouse-report.json`.
  - Target scores: Performance ≥ 90, Accessibility ≥ 95, Speed Index ≤ 2.2s.
- **Chrome DevTools References (`devtools-frontend`, `awesome-chrome-devtools`, `claude-devtools`):**
  - Inspect trace events, layout shifts, unminified JS evaluation, and memory leaks.
