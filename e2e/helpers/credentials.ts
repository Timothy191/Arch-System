/**
 * Shared E2E test credentials helpers.
 *
 * Credentials resolve from env first (TEST_EMAIL / TEST_PASSWORD), falling back
 * to the local dev-seed defaults. Never hardcode these strings in spec files —
 * import from here so CI can override per-environment (S4: secrets hygiene).
 */
export const TEST_EMAIL = process.env.TEST_EMAIL || "admin@plantcor.os";
export const TEST_PASSWORD = process.env.TEST_PASSWORD || "Yugioh@123#";
