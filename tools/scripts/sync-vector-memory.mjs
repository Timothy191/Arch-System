#!/usr/bin/env node

/**
 * @file tools/scripts/sync-vector-memory.mjs
 * @description Ingests architectural context slices, rules, and retrospectives into
 * the RuFlo Swarm SQLite / Vector database (.swarm/memory.db). Enables on-demand,
 * semantic memory querying via memory-gateway-mcp without context bloat.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCH_ROOT = path.resolve(__dirname, '../..');
const FORK_ROOT = path.resolve(ARCH_ROOT, '..');

const SWARM_DB_PATH = path.join(ARCH_ROOT, '.swarm', 'memory.db');
const SCHEMA_PATH = path.join(ARCH_ROOT, '.swarm', 'schema.sql');

function ensureDatabase() {
  if (!fs.existsSync(path.dirname(SWARM_DB_PATH))) {
    fs.mkdirSync(path.dirname(SWARM_DB_PATH), { recursive: true });
  }

  const db = new DatabaseSync(SWARM_DB_PATH);
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);
  }
  return db;
}

function generateDeterministicId(namespace, key) {
  return crypto.createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 32);
}

function upsertMemoryEntry(db, entry) {
  const stmt = db.prepare(`
    INSERT INTO memory_entries (
      id, key, namespace, content, type, tags, metadata, provenance_type,
      created_at, updated_at, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active'
    )
    ON CONFLICT(namespace, key) DO UPDATE SET
      content = excluded.content,
      type = excluded.type,
      tags = excluded.tags,
      metadata = excluded.metadata,
      provenance_type = excluded.provenance_type,
      updated_at = excluded.updated_at,
      status = 'active'
  `);

  const now = Date.now();
  stmt.run(
    entry.id || generateDeterministicId(entry.namespace, entry.key),
    entry.key,
    entry.namespace,
    entry.content,
    entry.type || 'semantic',
    JSON.stringify(entry.tags || []),
    JSON.stringify(entry.metadata || {}),
    entry.provenance_type || 'system_observation',
    now,
    now
  );
}

async function syncContextSlices(db) {
  const contextDirs = [
    path.join(FORK_ROOT, 'skills-mcp', 'context'),
    path.join(ARCH_ROOT, '.agents', 'context'),
  ];

  let count = 0;
  for (const dir of contextDirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const key = path.basename(file, '.md');

      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : key;

      upsertMemoryEntry(db, {
        key,
        namespace: 'context',
        content,
        type: 'semantic',
        provenance_type: 'system_observation',
        tags: ['context-slice', key, 'architecture'],
        metadata: {
          title,
          sourceFile: filePath,
          length: content.length,
        },
      });
      count++;
    }
  }
  return count;
}

async function syncRules(db) {
  const rulesDir = path.join(ARCH_ROOT, '.agents', 'rules');
  if (!fs.existsSync(rulesDir)) return 0;

  const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
  let count = 0;

  for (const file of files) {
    const filePath = path.join(rulesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const key = path.basename(file, '.md');

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : key;

    upsertMemoryEntry(db, {
      key,
      namespace: 'rules',
      content,
      type: 'procedural',
      provenance_type: 'system_observation',
      tags: ['rule', key, 'standards'],
      metadata: {
        title,
        sourceFile: filePath,
      },
    });
    count++;
  }
  return count;
}

async function syncRetrospectives(db) {
  const indices = [
    path.join(FORK_ROOT, '.agents', 'memory_base', 'index.json'),
    path.join(ARCH_ROOT, '.agents', 'memory_base', 'index.json'),
  ];

  let count = 0;
  for (const indexPath of indices) {
    if (!fs.existsSync(indexPath)) continue;

    try {
      const raw = fs.readFileSync(indexPath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.entries)) {
        for (const item of data.entries) {
          if (!item?.id) continue;
          const key = item.id;
          const content = `[Incident: ${item.category}]\nError Signature: ${item.errorSignature}\nPrevention Rule: ${item.preventionRule}`;

          upsertMemoryEntry(db, {
            id: item.id,
            key,
            namespace: 'retrospectives',
            content,
            type: 'pattern',
            provenance_type: 'tool_result',
            tags: ['retrospective', item.category?.toLowerCase() || 'general', 'incident'],
            metadata: {
              category: item.category,
              errorSignature: item.errorSignature,
              preventionRule: item.preventionRule,
              remediationDiff: item.remediationDiff,
            },
          });
          count++;
        }
      }
    } catch (e) {
      console.warn(`Could not parse ${indexPath}:`, e.message);
    }
  }
  return count;
}

async function main() {
  console.log('⚡ [VECTOR MEMORY SYNC] Initializing RuFlo Swarm SQLite vector database...');
  const db = ensureDatabase();

  try {
    const contextCount = await syncContextSlices(db);
    console.log(`   ✓ Synced ${contextCount} architectural context slices`);

    const rulesCount = await syncRules(db);
    console.log(`   ✓ Synced ${rulesCount} engineering rules`);

    const retroCount = await syncRetrospectives(db);
    console.log(`   ✓ Synced ${retroCount} retrospective patterns`);

    const totalStmt = db.prepare(
      "SELECT count(*) as count FROM memory_entries WHERE status = 'active'"
    );
    const total = totalStmt.get().count;

    console.log(`\n🧠 [VECTOR MEMORY SYNC] Complete! Active vector memory entries: ${total}`);
    console.log(`   Location: ${SWARM_DB_PATH}`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('❌ Failed to sync vector memory:', err);
  process.exit(1);
});
