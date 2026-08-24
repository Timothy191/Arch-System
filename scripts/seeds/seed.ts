import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { seedControlRoom } from "./generators/control-room";
import { seedDrilling } from "./generators/drilling";
import { seedGeology } from "./generators/geology";
import { seedProduction } from "./generators/production";

// Load from potential .env locations (cwd, root, apps/portal)
const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../apps/portal/.env"),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  const args = process.argv.slice(2);
  const targetDept = args.find((a) => !a.startsWith("-")) || "all";

  console.log(`\n==============================================`);
  console.log(`🚀 Plantcor Multi-Department Seed Generator`);
  console.log(`🎯 Target Department: ${targetDept.toUpperCase()}`);
  console.log(`==============================================\n`);

  // Optional RPC cache reload attempt
  try {
    const { error } = await supabase.rpc("reload_schema_cache");
    if (!error) {
      console.log("✓ PostgREST schema cache reloaded via RPC.\n");
    }
  } catch {
    // Non-blocking fallback
  }

  try {
    if (targetDept === "all" || targetDept === "control-room") {
      await seedControlRoom(supabase);
    }
    if (targetDept === "all" || targetDept === "drilling") {
      await seedDrilling(supabase);
    }
    if (targetDept === "all" || targetDept === "production" || targetDept === "processing") {
      await seedProduction(supabase);
    }
    if (targetDept === "all" || targetDept === "geology" || targetDept === "satellite") {
      await seedGeology(supabase);
    }

    console.log(`\n==============================================`);
    console.log(`✅ All requested department seeds completed!`);
    console.log(`==============================================\n`);
  } catch (err) {
    console.error("\n❌ Seed generator execution failed:", err);
    process.exit(1);
  }
}

run();
