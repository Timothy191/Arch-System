const { execSync } = require('child_process');
const { createHash } = require('crypto');
const { readdirSync, statSync, readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(REPO_ROOT, 'assets');
const CHECKSUM_FILE = path.join(REPO_ROOT, '.assets-checksum');
const SYNC_SCRIPT = path.join(__dirname, 'sync-assets.sh');

function getFileHash(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
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
    .map(f => getFileHash(f))
    .join('');
  return createHash('sha256').update(combined).digest('hex');
}

if (!existsSync(ASSETS_DIR)) {
  console.log('⚠️  No assets directory found.');
  process.exit(0);
}

const currentChecksum = getAssetsChecksum(ASSETS_DIR);
const previousChecksum = existsSync(CHECKSUM_FILE)
  ? readFileSync(CHECKSUM_FILE, 'utf8').trim()
  : '';

if (currentChecksum === previousChecksum) {
  console.log('✅ Assets unchanged, skipping sync.');
  process.exit(0);
}

console.log('🔄 Assets changed, synchronizing...');
execSync(`bash ${SYNC_SCRIPT}`, { stdio: 'inherit' });
writeFileSync(CHECKSUM_FILE, currentChecksum);
console.log('✅ Assets synced and checksum updated.');