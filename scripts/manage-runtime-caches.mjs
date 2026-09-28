#!/usr/bin/env node
import { existsSync, rmSync, statSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO_ROOT = resolve(process.cwd());

const CACHE_DIRS = [
  resolve(REPO_ROOT, '.turbo/cache'),
  resolve(REPO_ROOT, 'apps/portal/.next/cache'),
  resolve(REPO_ROOT, 'apps/cms/.next/cache'),
  resolve(REPO_ROOT, 'apps/overview/.next/cache'),
  resolve(REPO_ROOT, 'node_modules/.cache'),
];

function getDirectorySize(dirPath) {
  if (!existsSync(dirPath)) return 0;
  let totalSize = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        totalSize += statSync(fullPath).size;
      }
    }
  } catch {
    // Ignore permissions or deleted files
  }
  return totalSize;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

const isClean = process.argv.includes('--clean');
const isStatus = process.argv.includes('--status') || !isClean;

if (isClean) {
  console.log('🧹 Cleaning runtime caches...');
  let cleanedCount = 0;
  for (const dir of CACHE_DIRS) {
    if (existsSync(dir)) {
      const size = getDirectorySize(dir);
      try {
        rmSync(dir, { recursive: true, force: true });
        console.log(`  ✓ Cleared ${dir.replace(REPO_ROOT + '/', '')} (${formatSize(size)})`);
        cleanedCount++;
      } catch (err) {
        console.error(`  ✖ Failed to clear ${dir}:`, err.message);
      }
    }
  }
  console.log(`✨ Cache clean complete: ${cleanedCount} cache directories cleared.`);
} else if (isStatus) {
  console.log('📊 Cache Status:');
  let totalBytes = 0;
  for (const dir of CACHE_DIRS) {
    const relPath = dir.replace(REPO_ROOT + '/', '');
    if (existsSync(dir)) {
      const size = getDirectorySize(dir);
      totalBytes += size;
      console.log(`  • ${relPath}: ${formatSize(size)}`);
    } else {
      console.log(`  • ${relPath}: (not present)`);
    }
  }
  console.log(`Total cache size: ${formatSize(totalBytes)}`);
}
