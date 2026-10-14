import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { seedControlRoom } from './generators/control-room';
import { seedDrilling } from './generators/drilling';
import { seedProduction } from './generators/production';

// Load from the first available .env location with real credentials (prioritizing apps/portal/.env)
const candidateEnvPaths = [
  path.resolve(__dirname, '../../apps/portal/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (
      (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY)
    ) {
      break;
    }
  }
}

const rawUrl = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL].find(
  (v) => v && /^https?:\/\//i.test(v.trim())
);
const SUPABASE_URL = rawUrl?.trim();
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY
)?.trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

import { seedOperators } from './generators/operators';

async function run() {
  const args = process.argv.slice(2);
  const targetDept = args.find((a) => !a.startsWith('-')) || 'all';

  console.log(`\n==============================================`);
  console.log(`🚀 Plantcor Multi-Department Seed Generator`);
  console.log(`🎯 Target Department: ${targetDept.toUpperCase()}`);
  console.log(`==============================================\n`);

  // Optional RPC cache reload attempt
  try {
    const { error } = await supabase.rpc('reload_schema_cache');
    if (!error) {
      console.log('✓ PostgREST schema cache reloaded via RPC.\n');
    }
  } catch {
    // Non-blocking fallback
  }

  try {
    if (targetDept === 'all' || targetDept === 'operators') {
      await seedOperators(supabase);
    }
    if (targetDept === 'all' || targetDept === 'control-room') {
      await seedControlRoom(supabase);
    }
    if (targetDept === 'all' || targetDept === 'drilling') {
      await seedDrilling(supabase);
    }
    if (targetDept === 'all' || targetDept === 'production' || targetDept === 'processing') {
      await seedProduction(supabase);
    }

    console.log(`\n==============================================`);
    console.log(`✅ All requested department seeds completed!`);
    console.log(`==============================================\n`);
  } catch (err) {
    console.error('\n❌ Seed generator execution failed:', err);
    process.exit(1);
  }
}

run();
