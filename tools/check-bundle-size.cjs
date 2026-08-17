/**
 * Bundle-size gate for the portal production build.
 *
 * Replaces the `bundlesize` npm package, whose dependency chain
 * (bundlesize → brotli-size@0.1.0 → iltorb) is unmaintained and crashes on
 * modern Node (`ERR_DLOPEN_FAILED`). This checker keeps the same config file
 * (`.bundlesize-config.json`) and semantics — every matching file's GZIPPED
 * size must stay under its `maxSize` — but uses Node's built-in `zlib`, so it
 * works on any supported Node version with zero native deps.
 *
 * Usage: node tools/check-bundle-size.cjs   (after `pnpm --filter portal build`)
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { globSync } = require("glob");

const ROOT = path.join(__dirname, "..");
const configPath = path.join(ROOT, ".bundlesize-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const bytes = (n) => `${(n / 1024).toFixed(1)} kB`;

/** Parse "200 kB" / "1 MB" style sizes into bytes. */
function parseSize(size) {
  const match = /^([\d.]+)\s*(b|kb|mb|gb)?$/i.exec(String(size).trim());
  if (!match) throw new Error(`Invalid maxSize in .bundlesize-config.json: ${size}`);
  const value = parseFloat(match[1]);
  const unit = (match[2] || "b").toLowerCase();
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[unit];
  return value * mult;
}

let failures = 0;
let checked = 0;

for (const entry of config.files) {
  const matches = globSync(entry.path, { cwd: ROOT });
  if (matches.length === 0) {
    console.warn(`  ⚠  no files matched "${entry.path}" — run pnpm --filter portal build first`);
    continue;
  }
  const maxBytes = parseSize(entry.maxSize);
  for (const rel of matches) {
    const abs = path.join(ROOT, rel);
    const raw = fs.readFileSync(abs);
    const gz = zlib.gzipSync(raw).length;
    checked += 1;
    if (gz > maxBytes) {
      failures += 1;
      console.error(`  ✖ ${rel}: gzip ${bytes(gz)} > ${entry.maxSize}`);
    } else {
      console.log(`  ✓ ${rel}: gzip ${bytes(gz)} ≤ ${entry.maxSize}`);
    }
  }
}

console.log(`\nChecked ${checked} file(s).`);
if (failures > 0) {
  console.error(`✖ Bundle size gate failed: ${failures} file(s) over budget.`);
  process.exit(1);
}
console.log("✓ Bundle size gate passed.");
