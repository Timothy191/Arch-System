/**
 * Arch-System Smart Asset Synchronizer
 *
 * Purpose:
 * This script smartly synchronizes assets by checking if any files in the `assets/`
 * directory have changed since the last run. It generates a combined SHA-256 checksum
 * of all asset files, compares it to a stored checksum (`.assets-checksum`), and
 * ONLY executes `sync-assets.sh` if changes are detected.
 *
 * This significantly speeds up local development and CI/CD pipelines by skipping
 * the heavy rsync/copy process when assets haven't been modified.
 *
 * Usage:
 *   node scripts/sync-assets-smart.cjs
 */

const { execSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readdirSync, readFileSync, statSync, writeFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(REPO_ROOT, 'assets');
const CHECKSUM_FILE = path.join(REPO_ROOT, '.assets-checksum');
const SYNC_SCRIPT = path.join(__dirname, 'sync-assets.sh');
const DEPT_IMAGES_DIR = path.join(REPO_ROOT, 'apps/portal/public/images/departments');
const MAX_WEBP_BANNER_BYTES = 95 * 1024;
const WEBP_BANNER_WIDTH = 768;
const WEBP_BANNER_HEIGHT = 432;
const WEBP_BANNER_QUALITY = 76;
const WEBP_BANNER_EFFORT = 6;
const WEBP_BANNER_SUFFIX = '.webp';

const MAX_WEBP_CARD_BYTES = 45 * 1024;
const WEBP_CARD_WIDTH = 480;
const WEBP_CARD_HEIGHT = 270;
const WEBP_CARD_QUALITY = 74;
const WEBP_CARD_EFFORT = 6;
const WEBP_CARD_SUFFIX = '-card.webp';

const JPG_EXTENSION = '.jpg';

const DEPARTMENT_WEBP_DERIVATIVES = [
  {
    suffix: WEBP_BANNER_SUFFIX,
    width: WEBP_BANNER_WIDTH,
    height: WEBP_BANNER_HEIGHT,
    quality: WEBP_BANNER_QUALITY,
    effort: WEBP_BANNER_EFFORT,
    maxBytes: MAX_WEBP_BANNER_BYTES,
  },
  {
    suffix: WEBP_CARD_SUFFIX,
    width: WEBP_CARD_WIDTH,
    height: WEBP_CARD_HEIGHT,
    quality: WEBP_CARD_QUALITY,
    effort: WEBP_CARD_EFFORT,
    maxBytes: MAX_WEBP_CARD_BYTES,
  },
];

function resolveSharp() {
  try {
    return require('sharp');
  } catch {
    const pnpmDir = path.join(REPO_ROOT, 'node_modules/.pnpm');
    if (!existsSync(pnpmDir)) return null;
    const sharpPkg = readdirSync(pnpmDir).find((entry) => entry.startsWith('sharp@'));
    if (!sharpPkg) return null;
    const candidate = path.join(pnpmDir, sharpPkg, 'node_modules/sharp');
    return existsSync(candidate) ? require(candidate) : null;
  }
}

async function shouldRegenerateWebp({ sharp, outputPath, width, height, maxBytes }) {
  if (!existsSync(outputPath)) return true;
  if (statSync(outputPath).size > maxBytes) return true;
  const meta = await sharp(outputPath).metadata();
  return meta.width !== width || meta.height !== height;
}

async function ensureSingleWebpDerivative(options) {
  const { sharp, sourcePath, outputPath, width, height, quality, effort, maxBytes } = options;
  const needsOptimization = await shouldRegenerateWebp({
    sharp,
    outputPath,
    width,
    height,
    maxBytes,
  });
  if (!needsOptimization) return;

  await sharp(sourcePath)
    .resize({ width, height, fit: 'cover' })
    .webp({
      quality,
      effort,
      smartSubsampling: true,
    })
    .toFile(outputPath);
}

async function ensureOptimizedDepartmentWebpBanners() {
  if (!existsSync(DEPT_IMAGES_DIR)) return;
  const sharp = resolveSharp();
  if (!sharp) return;

  const jpgFiles = readdirSync(DEPT_IMAGES_DIR).filter((file) => file.endsWith(JPG_EXTENSION));
  for (const jpgFile of jpgFiles) {
    const baseName = path.basename(jpgFile, JPG_EXTENSION);
    const sourcePath = path.join(DEPT_IMAGES_DIR, jpgFile);
    for (const derivative of DEPARTMENT_WEBP_DERIVATIVES) {
      const outputPath = path.join(DEPT_IMAGES_DIR, `${baseName}${derivative.suffix}`);
      await ensureSingleWebpDerivative({
        sharp,
        sourcePath,
        outputPath,
        width: derivative.width,
        height: derivative.height,
        quality: derivative.quality,
        effort: derivative.effort,
        maxBytes: derivative.maxBytes,
      });
    }
  }
}

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
    .map((f) => getFileHash(f))
    .join('');
  return createHash('sha256').update(combined).digest('hex');
}

async function main() {
  try {
    await ensureOptimizedDepartmentWebpBanners();
  } catch (imgErr) {
    console.warn('⚠️  Warning: Department WebP optimization skipped:', imgErr.message);
  }

  // The assets/ directory exists locally but is not git-tracked, so
  // GitHub-triggered Vercel builds have no assets/ at all. Skip gracefully.
  if (!existsSync(ASSETS_DIR)) {
    console.log('✅ Assets directory not found, skipping sync.');
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

  console.log(
    `🔄 Assets changed (Old: ${previousChecksum || 'none'} -> New: ${currentChecksum}). Synchronizing...`
  );

  try {
    // Execute the actual bash sync script
    execSync(`bash ${SYNC_SCRIPT}`, { stdio: 'inherit' });
    await ensureOptimizedDepartmentWebpBanners();

    // Only update checksum if the sync was successful
    writeFileSync(CHECKSUM_FILE, currentChecksum);
    console.log('✅ Assets synced successfully and checksum updated.');
  } catch (error) {
    console.error('❌ Error: Asset synchronization failed!');
    console.error(error.message);
    // Do NOT update checksum, so it will try again next time
    process.exit(1);
  }
}

if (require.main === module) {
  // Always ensure automated versioning and build metadata are synchronized
  if (process.env.SKIP_VERSION_SYNC !== '1') {
    try {
      const versionManager = path.join(REPO_ROOT, 'tools/scripts/version-manager.mjs');
      if (existsSync(versionManager)) {
        execSync(`node "${versionManager}" sync`, { stdio: 'inherit' });
      }
    } catch (verErr) {
      console.warn('⚠️  Warning: Version sync failed:', verErr.message);
    }
  }

  main();
}

module.exports = {
  ensureOptimizedDepartmentWebpBanners,
};
