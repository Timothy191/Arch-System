#!/usr/bin/env node

/**
 * @fileoverview Retrospective Cleanup Utility
 * Usage: node tools/scripts/retrospective-cleanup.cjs [--dry-run | --older-than <days> | --category <cat>]
 *
 * Features:
 * - Remove retrospectives older than N days
 * - Remove retrospectives by category
 * - Remove duplicate retrospectives
 * - Consolidate similar retrospectives
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, '.agents', 'memory_base');
const RETRO_DIR = path.join(MEMORY_DIR, 'retrospectives');
const ARCHIVE_DIR = path.join(MEMORY_DIR, 'retrospectives-archived');

function ensureDirs() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
}

function loadRetrospectives() {
  if (!fs.existsSync(RETRO_DIR)) {
    return [];
  }

  const files = fs.readdirSync(RETRO_DIR).filter((f) => f.endsWith('.json'));
  const retrospectives = [];

  for (const file of files) {
    try {
      const filePath = path.join(RETRO_DIR, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      retrospectives.push({
        file,
        path: filePath,
        ...content,
      });
    } catch (e) {
      console.warn(`⚠️ Failed to load ${file}: ${e.message}`);
    }
  }

  return retrospectives;
}

function removeOlderThan(days, dryRun = false) {
  ensureDirs();
  const retrospectives = loadRetrospectives();
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let removed = 0;

  for (const retro of retrospectives) {
    const timestamp = new Date(retro.timestamp || retro.createdAt || 0);
    if (timestamp < cutoffDate) {
      if (dryRun) {
        console.log(`[DRY-RUN] Would archive: ${retro.file} (${retro.timestamp})`);
        removed++;
      } else {
        console.log(`🗑️ Archiving: ${retro.file} (${retro.timestamp})`);
        fs.renameSync(retro.path, path.join(ARCHIVE_DIR, retro.file));
        removed++;
      }
    }
  }

  if (dryRun && removed > 0) {
    console.log(`[DRY-RUN] Would archive ${removed} retrospectives older than ${days} days`);
  } else if (removed > 0) {
    console.log(`✅ Archived ${removed} retrospectives older than ${days} days`);
  }
}

function removeByCategory(category, dryRun = false) {
  ensureDirs();
  const retrospectives = loadRetrospectives();
  let removed = 0;

  for (const retro of retrospectives) {
    if (retro.category === category) {
      if (dryRun) {
        console.log(`[DRY-RUN] Would archive: ${retro.file} [${category}]`);
        removed++;
      } else {
        console.log(`🗑️ Archiving: ${retro.file} [${category}]`);
        fs.renameSync(retro.path, path.join(ARCHIVE_DIR, retro.file));
        removed++;
      }
    }
  }

  if (dryRun && removed > 0) {
    console.log(`[DRY-RUN] Would archive ${removed} retrospectives in category: ${category}`);
  } else if (removed > 0) {
    console.log(`✅ Archived ${removed} retrospectives in category: ${category}`);
  }
}

function removeDuplicates(dryRun = false) {
  ensureDirs();
  const retrospectives = loadRetrospectives();
  const seen = new Set();
  let removed = 0;

  for (const retro of retrospectives) {
    const signature = retro.errorSignature || retro.id;
    if (seen.has(signature)) {
      if (dryRun) {
        console.log(`[DRY-RUN] Would archive duplicate: ${retro.file} (${signature})`);
        removed++;
      } else {
        console.log(`🗑️ Archiving duplicate: ${retro.file} (${signature})`);
        fs.renameSync(retro.path, path.join(ARCHIVE_DIR, retro.file));
        removed++;
      }
    } else {
      seen.add(signature);
    }
  }

  if (dryRun && removed > 0) {
    console.log(`[DRY-RUN] Would archive ${removed} duplicate retrospectives`);
  } else if (removed > 0) {
    console.log(`✅ Archived ${removed} duplicate retrospectives`);
  }
}

function analyzeRetrospectives() {
  const retrospectives = loadRetrospectives();

  console.log('📊 Retrospective Analysis\n');
  console.log(`Total: ${retrospectives.length}`);

  const byCategory = {};
  const byAge = { recent: 0, week: 0, month: 0, old: 0 };
  const now = Date.now();

  for (const retro of retrospectives) {
    const category = retro.category || 'UNKNOWN';
    byCategory[category] = (byCategory[category] || 0) + 1;

    const timestamp = new Date(retro.timestamp || retro.createdAt || 0).getTime();
    const ageDays = (now - timestamp) / (1000 * 60 * 60 * 24);

    if (ageDays < 7) {
      byAge.recent++;
    } else if (ageDays < 30) {
      byAge.week++;
    } else if (ageDays < 90) {
      byAge.month++;
    } else {
      byAge.old++;
    }
  }

  console.log('\nBy Category:');
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });

  console.log('\nBy Age:');
  console.log(`  < 7 days: ${byAge.recent}`);
  console.log(`  7-30 days: ${byAge.week}`);
  console.log(`  30-90 days: ${byAge.month}`);
  console.log(`  > 90 days: ${byAge.old}`);

  // Check for duplicates
  const signatures = retrospectives.map((r) => r.errorSignature || r.id);
  const uniqueSignatures = new Set(signatures);
  if (signatures.length !== uniqueSignatures.size) {
    console.log(`\n⚠️ Duplicates detected: ${signatures.length - uniqueSignatures.size}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('⚠️ DRY RUN MODE - No changes will be made\n');
  }

  const olderThanIdx = args.indexOf('--older-than');
  const categoryIdx = args.indexOf('--category');
  const removeDuplicatesFlag = args.includes('--remove-duplicates');

  if (olderThanIdx !== -1 && args[olderThanIdx + 1]) {
    const days = parseInt(args[olderThanIdx + 1], 10);
    if (isNaN(days)) {
      console.error('Invalid days value for --older-than');
      process.exit(1);
    }
    console.log(`🧹 Removing retrospectives older than ${days} days...\n`);
    removeOlderThan(days, dryRun);
  } else if (categoryIdx !== -1 && args[categoryIdx + 1]) {
    const category = args[categoryIdx + 1];
    console.log(`🧹 Removing retrospectives in category: ${category}...\n`);
    removeByCategory(category, dryRun);
  } else if (removeDuplicatesFlag) {
    console.log('🧹 Removing duplicate retrospectives...\n');
    removeDuplicates(dryRun);
  } else {
    analyzeRetrospectives();
  }

  // Re-index memory base
  if (!dryRun && (olderThanIdx !== -1 || categoryIdx !== -1 || removeDuplicatesFlag)) {
    console.log('\n🧹 Re-indexing memory base...\n');
    try {
      require('./smart-indexer.cjs');
    } catch (e) {
      console.warn('⚠️ Failed to re-index memory base:', e.message);
    }
  }
}

main();
