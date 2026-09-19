#!/usr/bin/env node

/**
 * @fileoverview Smart Memory Indexer & Retrospective Search CLI
 * Usage: node tools/scripts/smart-indexer.cjs [--query "<term>"]
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const MEMORY_DIR = path.join(ROOT, ".memory_base");
const RETRO_DIR = path.join(MEMORY_DIR, "retrospectives");
const INDEX_FILE = path.join(MEMORY_DIR, "index.json");

if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}
if (!fs.existsSync(RETRO_DIR)) {
  fs.mkdirSync(RETRO_DIR, { recursive: true });
}

const args = process.argv.slice(2);
let query = null;
const queryIdx = args.indexOf("--query");
if (queryIdx !== -1 && args[queryIdx + 1]) {
  query = args[queryIdx + 1].toLowerCase();
}

// Read all retrospectives
const files = fs.readdirSync(RETRO_DIR).filter((f) => f.endsWith(".json"));
const entries = [];

for (const file of files) {
  try {
    const raw = fs.readFileSync(path.join(RETRO_DIR, file), "utf-8");
    const data = JSON.parse(raw);
    entries.push(data);
  } catch (_e) {
    // skip malformed
  }
}

// Build index
const indexData = {
  lastUpdated: new Date().toISOString(),
  totalRetrospectives: entries.length,
  entries: entries.map((e) => ({
    id: e.id,
    category: e.category,
    errorSignature: e.errorSignature,
    preventionRule: e.preventionRule,
  })),
};

fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), "utf-8");

if (query) {
  console.log(`🧠 [SmartIndexer] Searching memory base for query: "${query}"...`);
  const matches = entries.filter((e) => {
    const searchStr = `${e.id} ${e.category} ${e.errorSignature} ${e.rootCause || ""} ${e.preventionRule || ""}`.toLowerCase();
    return searchStr.includes(query);
  });

  if (matches.length > 0) {
    console.log(`Found ${matches.length} matching retrospective(s):\n`);
    matches.forEach((m, idx) => {
      console.log(`  ${idx + 1}. [${m.category}] ${m.id}`);
      console.log(`     Error: ${m.errorSignature}`);
      console.log(`     Rule:  ${m.preventionRule}\n`);
    });
  } else {
    console.log(`No direct retrospectives matching "${query}". Proceed with standard guardrails.\n`);
  }
} else {
  console.log(`🧠 [SmartIndexer] Memory base synchronized. Total entries indexed: ${entries.length}`);
}

