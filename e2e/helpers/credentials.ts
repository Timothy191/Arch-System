/**
 * Shared E2E test credentials helpers.
 *
 * Credentials are env-only (TEST_EMAIL / TEST_PASSWORD) — never hardcoded.
 * Fails fast at spec load with an actionable error when unset, so a run can
 * never silently target a wrong or missing environment (S4: secrets hygiene).
 * e2e/playwright.config.ts bridges values from the gitignored apps/portal/.env
 * (TEST_* or SMOKE_TEST_*) into the environment before specs are loaded.
 */
export const TEST_EMAIL = requireEnv('TEST_EMAIL');
export const TEST_PASSWORD = requireEnv('TEST_PASSWORD');

function requireEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(
      `E2E credentials: environment variable ${name} is not set. ` +
        'Provide TEST_EMAIL and TEST_PASSWORD (export them, or add SMOKE_TEST_EMAIL / ' +
        'SMOKE_TEST_PASSWORD to the gitignored apps/portal/.env) before running E2E.'
    );
  }
  return raw;
}
