#!/usr/bin/env node

/**
 * @fileoverview Syncs packages/database/migrations to packages/supabase/migrations.
 * Usage: node tools/sync-migrations.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DB_MIGRATIONS = path.join(ROOT, "packages", "database", "migrations");
const SUPABASE_MIGRATIONS = path.join(ROOT, "packages", "supabase", "migrations");

function getSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function syncMigrations() {
  if (!fs.existsSync(SUPABASE_MIGRATIONS)) {
    fs.mkdirSync(SUPABASE_MIGRATIONS, { recursive: true });
  }

  const dbFiles = getSqlFiles(DB_MIGRATIONS);
  let copied = 0;
  let skipped = 0;

  for (const file of dbFiles) {
    const src = path.join(DB_MIGRATIONS, file);
    const dest = path.join(SUPABASE_MIGRATIONS, file);
    const content = fs.readFileSync(src, "utf-8");

    if (fs.existsSync(dest)) {
      const existing = fs.readFileSync(dest, "utf-8");
      if (existing === content) {
        skipped++;
        continue;
      }
    }

    fs.writeFileSync(dest, content, "utf-8");
    copied++;
  }

  console.log(`✅ Synced ${copied} migrations, ${skipped} unchanged.`);
  process.exit(0);
}

syncMigrations();
