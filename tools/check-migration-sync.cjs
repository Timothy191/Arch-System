#!/usr/bin/env node

/**
 * @fileoverview Checks that pkgs/database/migrations and
 * pkgs/supabase/migrations are in sync.
 * Usage: node tools/check-migration-sync.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DB_MIGRATIONS = path.join(ROOT, "pkgs", "database", "migrations");
const SUPABASE_MIGRATIONS = path.join(ROOT, "pkgs", "supabase", "migrations");

function getSqlFiles(dir) {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort(),
  );
}

function readFile(dir, file) {
  return fs.readFileSync(path.join(dir, file), "utf-8");
}

function checkSync() {
  const dbFiles = getSqlFiles(DB_MIGRATIONS);
  const supabaseFiles = getSqlFiles(SUPABASE_MIGRATIONS);

  let hasErrors = false;

  const onlyInDb = [...dbFiles].filter((f) => !supabaseFiles.has(f));
  const onlyInSupabase = [...supabaseFiles].filter((f) => !dbFiles.has(f));
  const inBoth = [...dbFiles].filter((f) => supabaseFiles.has(f));

  if (onlyInDb.length > 0) {
    console.error("\n❌ Files in pkgs/database/migrations but missing from pkgs/supabase/migrations:");
    onlyInDb.forEach((f) => console.error(`  - ${f}`));
    hasErrors = true;
  }

  if (onlyInSupabase.length > 0) {
    console.error("\n❌ Files in pkgs/supabase/migrations but missing from pkgs/database/migrations:");
    onlyInSupabase.forEach((f) => console.error(`  - ${f}`));
    hasErrors = true;
  }

  let diffCount = 0;
  for (const file of inBoth) {
    const dbContent = readFile(DB_MIGRATIONS, file);
    const supabaseContent = readFile(SUPABASE_MIGRATIONS, file);
    if (dbContent !== supabaseContent) {
      console.error(`\n❌ Content mismatch: ${file}`);
      diffCount++;
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log("✅ Migration directories are in sync.");
    process.exit(0);
  } else {
    console.error("\n💡 Fix: Run 'pnpm policy:migrations:sync' to copy database migrations to supabase/migrations/");
    process.exit(1);
  }
}

checkSync();
