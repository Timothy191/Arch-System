import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Bridge E2E credentials from the gitignored apps/portal/.env into process.env.
 * Precedence: real env (TEST_EMAIL / TEST_PASSWORD) > SMOKE_TEST_* in apps/portal/.env >
 * TEST_* in apps/portal/.env. When nothing is found, e2e/helpers/credentials.ts throws
 * a fail-fast error at spec load instead of silently using committed literals.
 */
function loadDevCredentials(): void {
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) return;
  const envFile = path.resolve(process.cwd(), 'apps/portal/.env');
  if (!existsSync(envFile)) return;
  const entries = new Map<string, string>();
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim());
    if (match) entries.set(match[1], match[2]);
  }
  const fallbackPairs: ReadonlyArray<readonly [string, string]> = [
    ['TEST_EMAIL', 'SMOKE_TEST_EMAIL'],
    ['TEST_PASSWORD', 'SMOKE_TEST_PASSWORD'],
  ];
  for (const [target, fallbackName] of fallbackPairs) {
    const resolved = process.env[target] || entries.get(target) || entries.get(fallbackName);
    if (resolved) process.env[target] = resolved;
  }
}

loadDevCredentials();

/** Resolve a Chrome/Chromium executable across environments.
 * Priority: explicit GOOGLE_CHROME_SHIM path -> system chrome -> playwright's bundled chromium.
 */
function resolveChromeExecutable(): string | undefined {
  const candidates = [
    process.env.GOOGLE_CHROME_SHIM,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const chromeExecutable = resolveChromeExecutable();

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
  testDir: '.',
  snapshotDir: './visual/__snapshots__',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit parallel workers locally so Next.js dev server on-demand compilation is not overloaded. */
  workers: process.env.CI ? 1 : 2,
  timeout: 60000,
  /* Scratch specs live outside the suite until promoted or deleted. */
  testIgnore: ['temp/**'],
  /* Reporter to use: failures reporter prints unexpected outcomes as they occur (Playwright >= 1.65),
   * HTML report keeps only non-passing tests to stay scannable. */
  reporter: [['failures'], ['html', { open: 'never', onlyFailures: true }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    userAgent: 'Playwright/E2E-Tests',
    headless: Boolean(process.env.CI),
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        launchOptions: chromeExecutable ? { executablePath: chromeExecutable } : undefined,
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        launchOptions: chromeExecutable ? { executablePath: chromeExecutable } : undefined,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        launchOptions: chromeExecutable ? { executablePath: chromeExecutable } : undefined,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'tablet-chrome',
      use: {
        ...devices['Galaxy Tab S4'],
        browserName: 'chromium',
        launchOptions: chromeExecutable ? { executablePath: chromeExecutable } : undefined,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Default to Chromium locally; enable WebKit field-tablet testing via PLAYWRIGHT_WEBKIT=1
    ...(process.env.PLAYWRIGHT_WEBKIT === '1'
      ? [
          {
            name: 'tablet-safari',
            use: {
              ...devices['iPad Pro 11'],
              browserName: 'webkit' as const,
              storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter portal dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
          ...process.env,
          NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-deprecation`.trim(),
        },
      },
});
