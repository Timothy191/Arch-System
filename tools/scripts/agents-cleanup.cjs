#!/usr/bin/env node

/**
 * @fileoverview .agents Directory Cleanup Utility
 * Removes stale, non-functional, and outdated content from .agents/
 *
 * Usage: node tools/scripts/agents-cleanup.cjs [--dry-run | --aggressive]
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(ROOT, '.agents');
const ARCHIVE_DIR = path.join(AGENTS_DIR, '.archived');

function ensureArchiveDir() {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
}

function archivePath(sourcePath, relativePath) {
  ensureArchiveDir();
  const archivePath = path.join(ARCHIVE_DIR, relativePath);
  const archiveParent = path.dirname(archivePath);

  if (!fs.existsSync(archiveParent)) {
    fs.mkdirSync(archiveParent, { recursive: true });
  }

  if (fs.existsSync(archivePath)) {
    console.log(`⚠️ Archive already exists: ${relativePath}, skipping`);
    return;
  }

  console.log(`🗑️ Archiving: ${relativePath}`);
  fs.renameSync(sourcePath, archivePath);
}

function analyzeAndCleanup(dryRun = false, aggressive = false) {
  console.log('🧹 .agents Directory Cleanup\n');

  // 1. analyze.py - Incorrect path references
  const analyzePy = path.join(AGENTS_DIR, 'analyze.py');
  if (fs.existsSync(analyzePy)) {
    const content = fs.readFileSync(analyzePy, 'utf-8');
    if (content.includes('/home/timothy/Projects/Arch-System/.agents')) {
      console.log('📋 Found stale analyze.py with incorrect path references');
      if (!dryRun) {
        archivePath(analyzePy, 'analyze.py');
      } else {
        console.log('[DRY-RUN] Would archive: analyze.py');
      }
    }
  }

  // 2. audit.log - Single old entry from 2026-09-11
  const auditLog = path.join(AGENTS_DIR, 'audit.log');
  if (fs.existsSync(auditLog)) {
    const content = fs.readFileSync(auditLog, 'utf-8');
    const data = JSON.parse(content);
    const timestamp = new Date(data.timestamp);
    const ageDays = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays > 30) {
      console.log('📋 Found stale audit.log (>30 days old)');
      if (!dryRun) {
        archivePath(auditLog, 'audit.log');
      } else {
        console.log('[DRY-RUN] Would archive: audit.log');
      }
    }
  }

  // 3. Old corpos storage logs (>7 days)
  const artifactsDir = path.join(AGENTS_DIR, 'corpos/storage/artifacts');
  if (fs.existsSync(artifactsDir)) {
    const logFiles = fs.readdirSync(artifactsDir).filter((f) => f.endsWith('.log'));
    let archivedLogs = 0;

    for (const logFile of logFiles) {
      const logPath = path.join(artifactsDir, logFile);
      const stats = fs.statSync(logPath);
      const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > 7) {
        if (!dryRun) {
          archivePath(logPath, `corpos/storage/artifacts/${logFile}`);
          archivedLogs++;
        } else {
          console.log(`[DRY-RUN] Would archive: corpos/storage/artifacts/${logFile}`);
          archivedLogs++;
        }
      }
    }

    if (!dryRun && archivedLogs > 0) {
      console.log(`✅ Archived ${archivedLogs} old log files`);
    } else if (dryRun && archivedLogs > 0) {
      console.log(`[DRY-RUN] Would archive ${archivedLogs} old log files`);
    }
  }

  // 4. Teamwork artifacts from October 1st (old orchestration sessions)
  const teamworkDir = path.join(AGENTS_DIR, 'teamwork');
  if (fs.existsSync(teamworkDir) && aggressive) {
    const items = fs.readdirSync(teamworkDir, { withFileTypes: true });
    let archivedItems = 0;

    for (const item of items) {
      if (
        item.name === 'BRIEFING.md' ||
        item.name === 'handoff.md' ||
        item.name === 'ORIGINAL_REQUEST.md'
      ) {
        continue; // Keep these as reference
      }

      const itemPath = path.join(teamworkDir, item.name);
      const stats = fs.statSync(itemPath);
      const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > 7) {
        if (!dryRun) {
          if (item.isDirectory()) {
            archivePath(itemPath, `teamwork/${item.name}`);
          } else {
            archivePath(itemPath, `teamwork/${item.name}`);
          }
          archivedItems++;
        } else {
          console.log(`[DRY-RUN] Would archive: teamwork/${item.name}`);
          archivedItems++;
        }
      }
    }

    if (!dryRun && archivedItems > 0) {
      console.log(`✅ Archived ${archivedItems} old teamwork artifacts`);
    } else if (dryRun && archivedItems > 0) {
      console.log(`[DRY-RUN] Would archive ${archivedItems} old teamwork artifacts`);
    }
  }

  // 5. Old plans and reports (from 2026-09-19)
  const plansDir = path.join(AGENTS_DIR, 'plans');
  const reportsDir = path.join(AGENTS_DIR, 'reports');
  const manifestsDir = path.join(AGENTS_DIR, 'run-manifests');

  if (aggressive) {
    if (fs.existsSync(plansDir)) {
      const planFiles = fs.readdirSync(plansDir);
      for (const planFile of planFiles) {
        const planPath = path.join(plansDir, planFile);
        const stats = fs.statSync(planPath);
        const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        if (ageDays > 30) {
          if (!dryRun) {
            archivePath(planPath, `plans/${planFile}`);
          } else {
            console.log(`[DRY-RUN] Would archive: plans/${planFile}`);
          }
        }
      }
    }

    if (fs.existsSync(reportsDir)) {
      const reportFiles = fs.readdirSync(reportsDir);
      for (const reportFile of reportFiles) {
        const reportPath = path.join(reportsDir, reportFile);
        const stats = fs.statSync(reportPath);
        const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        if (ageDays > 30) {
          if (!dryRun) {
            archivePath(reportPath, `reports/${reportFile}`);
          } else {
            console.log(`[DRY-RUN] Would archive: reports/${reportFile}`);
          }
        }
      }
    }

    if (fs.existsSync(manifestsDir)) {
      const manifestFiles = fs.readdirSync(manifestsDir);
      for (const manifestFile of manifestFiles) {
        const manifestPath = path.join(manifestsDir, manifestFile);
        const stats = fs.statSync(manifestPath);
        const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        if (ageDays > 30) {
          if (!dryRun) {
            archivePath(manifestPath, `run-manifests/${manifestFile}`);
          } else {
            console.log(`[DRY-RUN] Would archive: run-manifests/${manifestFile}`);
          }
        }
      }
    }
  }

  // 6. CHECKLIST.md - Review for outdated information
  const checklistPath = path.join(AGENTS_DIR, 'CHECKLIST.md');
  if (fs.existsSync(checklistPath) && aggressive) {
    const content = fs.readFileSync(checklistPath, 'utf-8');
    if (content.includes('v26.8.1') || content.includes('/home/timothy/Projects')) {
      console.log('📋 Found CHECKLIST.md with outdated information');
      if (!dryRun) {
        console.log('⚠️ CHECKLIST.md needs manual review - not auto-archiving');
        console.log('💡 Contains outdated Node version and path references');
      } else {
        console.log('[DRY-RUN] CHECKLIST.md needs manual review (contains outdated info)');
      }
    }
  }

  console.log('\n✅ Cleanup complete\n');

  // Show new state
  if (!dryRun) {
    console.log('📊 New state:\n');
    console.log(`Total .agents size: ${(getDirSize(AGENTS_DIR) / 1024).toFixed(1)} KB`);
    console.log(`Archived size: ${(getDirSize(ARCHIVE_DIR) / 1024).toFixed(1)} KB`);
  }
}

function getDirSize(dirPath) {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return totalSize;

  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      totalSize += getDirSize(fullPath);
    } else {
      totalSize += fs.statSync(fullPath).size;
    }
  }
  return totalSize;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const aggressive = args.includes('--aggressive');

  if (dryRun) {
    console.log('⚠️ DRY RUN MODE - No changes will be made\n');
  }

  if (aggressive) {
    console.log('⚡ AGGRESSIVE MODE - More aggressive cleanup\n');
  }

  console.log('📊 Current state:\n');
  console.log(`Total .agents size: ${(getDirSize(AGENTS_DIR) / 1024).toFixed(1)} KB`);

  analyzeAndCleanup(dryRun, aggressive);
}

main();
