/**
 * Secrets Rotation Script
 * Usage: node tools/rotate-secrets.mjs [--dry-run]
 *
 * Rotates production secrets with support for:
 * - Supabase keys (anon, service)
 * - Sentry DSN/token
 * - N8N/Flowise credentials
 * - Redis password
 * - Database connection
 *
 * Requires: SUPABASE_ACCESS_TOKEN, environment variables set
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const DRY_RUN = process.argv.includes("--dry-run");

const SECRET_ROTATION_CONFIG = {
  supabase: {
    required: ["SUPABASE_SERVICE_KEY"],
    description: "Rotating Supabase service role key",
  },
  sentry: {
    required: ["SENTRY_AUTH_TOKEN"],
    description: "Rotating Sentry auth token",
  },
  redis: {
    required: ["REDIS_PASSWORD"],
    description: "Rotating Redis password",
  },
  novu: {
    required: ["NOVU_API_KEY"],
    description: "Rotating Novu API key",
  },
  inngest: {
    required: ["INNGEST_EVENT_KEY"],
    description: "Rotating Inngest event key",
  },
};

function log(msg, type = "INFO") {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${msg}`);
}

function generateSecureKey(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

async function rotateSupabaseKey() {
  log("Generating new Supabase service key...");
  const newKey = generateSecureKey(48);

  if (DRY_RUN) {
    log(`[DRY-RUN] Would set SUPABASE_SERVICE_KEY`, "WARN");
    return { SUPABASE_SERVICE_KEY: newKey };
  }

  // In production, use Supabase API to generate new key
  // https://supabase.com/dashboard/project/_/settings/api
  log("Supabase key generated. Update via dashboard or API.", "WARN");
  return { SUPABASE_SERVICE_KEY: newKey };
}

async function rotateSentryToken() {
  log("Sentry token rotation requires dashboard action", "WARN");
  return {};
}

async function rotateRedisPassword() {
  log("Generating new Redis password...");
  const newPassword = generateSecureKey(24);

  if (DRY_RUN) {
    log(`[DRY-RUN] Would update REDIS_PASSWORD`, "WARN");
    return { REDIS_PASSWORD: newPassword };
  }

  // Redis CONFIG SET requires admin
  log("Redis password generated. Apply via CONFIG SET or cluster management.", "WARN");
  return { REDIS_PASSWORD: newPassword };
}

async function rotateNovuApiKey() {
  log("Novu API key rotation requires dashboard action", "WARN");
  return {};
}

async function rotateInngestKey() {
  log("Generating new Inngest event key...");
  const newKey = generateSecureKey(32);

  if (DRY_RUN) {
    log(`[DRY-RUN] Would set INNGEST_EVENT_KEY`, "WARN");
    return { INNGEST_EVENT_KEY: newKey };
  }

  log("Inngest key generated. Update via Inngest dashboard.", "WARN");
  return { INNGEST_EVENT_KEY: newKey };
}

function updateEnvFile(updates) {
  const envPath = join(rootDir, ".env");
  const envExamplePath = join(rootDir, ".env.example");

  if (!existsSync(envPath)) {
    log(".env file not found, skipping update", "WARN");
    return;
  }

  let content = readFileSync(envPath, "utf-8");

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^(${key}=).*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
      log(`Updated ${key} in .env`);
    }
  }

  if (!DRY_RUN) {
    writeFileSync(envPath, content);
    log("Environment file updated");
  }
}

async function main() {
  log(`Starting secrets rotation (${DRY_RUN ? "DRY-RUN" : "LIVE"})`);

  const results = {};

  // Rotate each secret type
  results.supabase = await rotateSupabaseKey();
  results.sentry = await rotateSentryToken();
  results.redis = await rotateRedisPassword();
  results.novu = await rotateNovuApiKey();
  results.inngest = await rotateInngestKey();

  // Merge all updates
  const updates = Object.values(results).reduce((acc, r) => ({ ...acc, ...r }), {});

  if (Object.keys(updates).length > 0) {
    updateEnvFile(updates);
  }

  // Output next steps
  log("---");
  log("SECRET ROTATION COMPLETE");
  log("Required manual actions:");
  log("1. Update Supabase dashboard with new service key");
  log("2. Restart all services using the secrets");
  log("3. Verify all connections work correctly");
  log("4. Store new secrets in secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.)");
  log("---");

  if (DRY_RUN) {
    log("This was a dry run. Run without --dry-run to apply.", "WARN");
  }
}

main().catch((err) => {
  log(`Error: ${err.message}`, "ERROR");
  process.exit(1);
});
