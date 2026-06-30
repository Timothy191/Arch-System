/**
 * Arch-System Smart Asset Synchronizer
 *
 * Purpose:
 * This script smartly synchronizes assets by checking if any files in the `04_shared_static_assets/`
 * directory have changed since the last run. It generates a combined SHA-256 checksum
 * of all asset files, compares it to a stored checksum (`.assets-checksum`), and
 * ONLY executes `sync-assets.sh` if changes are detected.
 *
 * This significantly speeds up local development and CI/CD pipelines by skipping
 * the heavy rsync/copy process when assets haven't been modified.
 *
 * Usage:
 *   node 03_operations_automation/sync-assets-smart.cjs
 */

const { execSync } = require("child_process");
const { createHash } = require("crypto");
const { readdirSync, statSync, readFileSync, writeFileSync, existsSync } = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(REPO_ROOT, "04_shared_static_assets");
const CHECKSUM_FILE = path.join(REPO_ROOT, ".assets-checksum");
const SYNC_SCRIPT = path.join(__dirname, "sync-assets.sh");

function getFileHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function getAssetsChecksum(dir) {
  const files = [];
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(dir);
  const combined = files
    .sort()
    .map((f) => getFileHash(f))
    .join("");
  return createHash("sha256").update(combined).digest("hex");
}

if (!existsSync(ASSETS_DIR)) {
  console.log("⚠️  No 04_shared_static_assets/ directory found. Skipping sync.");
  process.exit(0);
}

const currentChecksum = getAssetsChecksum(ASSETS_DIR);
const previousChecksum = existsSync(CHECKSUM_FILE)
  ? readFileSync(CHECKSUM_FILE, "utf8").trim()
  : "";

if (currentChecksum === previousChecksum) {
  console.log("✅ Assets unchanged, skipping sync.");
  process.exit(0);
}

console.log(
  `🔄 Assets changed (Old: ${previousChecksum || "none"} -> New: ${currentChecksum}). Synchronizing...`,
);

try {
  // Execute the actual bash sync script
  execSync(`bash ${SYNC_SCRIPT}`, { stdio: "inherit" });

  // Only update checksum if the sync was successful
  writeFileSync(CHECKSUM_FILE, currentChecksum);
  console.log("✅ Assets synced successfully and checksum updated.");
} catch (error) {
  console.error("❌ Error: Asset synchronization failed!");
  console.error(error.message);
  // Do NOT update checksum, so it will try again next time
  process.exit(1);
}
