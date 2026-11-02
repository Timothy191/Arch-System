#!/usr/bin/env node
/**
 * @file optimize-svgs.cjs
 * Build-time zero-runtime SVG optimization utility using SVGO.
 * Optimizes SVG icons, SCADA diagrams, and UI assets across the monorepo.
 */

const fs = require('fs');
const path = require('path');
const { optimize } = require('svgo');

const ROOT = path.resolve(__dirname, '../..');

const SCAN_DIRS = [
  path.join(ROOT, 'apps/portal/public'),
  path.join(ROOT, 'packages/ui/src'),
];

const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          cleanupIds: false,
        },
      },
    },
    'removeDimensions',
    'sortAttrs',
  ],
};

function findSvgFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        results.push(...findSvgFiles(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith('.svg')) {
      results.push(fullPath);
    }
  }

  return results;
}

function runOptimization() {
  console.log('🎨 [SVGO] Scanning repository for SVG assets...');
  const allSvgs = SCAN_DIRS.flatMap(findSvgFiles);

  if (allSvgs.length === 0) {
    console.log('ℹ️  No standalone .svg files found in target directories.');
    return;
  }

  let totalOriginal = 0;
  let totalOptimized = 0;
  let optimizedCount = 0;

  for (const filePath of allSvgs) {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const originalBytes = Buffer.byteLength(rawContent, 'utf8');
    totalOriginal += originalBytes;

    try {
      const result = optimize(rawContent, {
        path: filePath,
        ...SVGO_CONFIG,
      });

      const optimizedBytes = Buffer.byteLength(result.data, 'utf8');
      totalOptimized += optimizedBytes;

      if (optimizedBytes < originalBytes) {
        fs.writeFileSync(filePath, result.data, 'utf8');
        optimizedCount++;
        const saved = originalBytes - optimizedBytes;
        const pct = ((saved / originalBytes) * 100).toFixed(1);
        const rel = path.relative(ROOT, filePath);
        console.log(`   ✓ ${rel} (-${saved}B, -${pct}%)`);
      }
    } catch (err) {
      console.warn(`   ⚠️  Failed to optimize ${filePath}:`, err.message);
      totalOptimized += originalBytes;
    }
  }

  const netSaved = totalOriginal - totalOptimized;
  const netPct = totalOriginal > 0 ? ((netSaved / totalOriginal) * 100).toFixed(1) : '0';

  console.log(`\n✅ [SVGO] Processed ${allSvgs.length} SVGs (${optimizedCount} optimized).`);
  console.log(`   Original: ${(totalOriginal / 1024).toFixed(2)} KB`);
  console.log(`   Optimized: ${(totalOptimized / 1024).toFixed(2)} KB`);
  console.log(`   Saved: ${(netSaved / 1024).toFixed(2)} KB (${netPct}% reduction)`);
}

runOptimization();
