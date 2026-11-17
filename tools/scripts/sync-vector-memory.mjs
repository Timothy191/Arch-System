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

  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      namespace TEXT NOT NULL,
      content TEXT,
      type TEXT,
      tags TEXT,
      metadata TEXT,
      provenance_type TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      status TEXT,
      UNIQUE(namespace, key)
    );
  `);

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
  const seenIds = new Set();

  // First sync full JSON retrospectives (active + archived) so rootCause, resolution, and affectedFiles are indexed
  const retroJsonDirs = [
    path.join(ARCH_ROOT, '.agents', 'memory_base', 'retrospectives'),
    path.join(ARCH_ROOT, '.agents', 'memory_base', 'retrospectives-archived'),
  ];
  for (const retroDir of retroJsonDirs) {
    if (!fs.existsSync(retroDir)) continue;
    const files = fs.readdirSync(retroDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(retroDir, file);
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!parsed || typeof parsed !== 'object') continue;
        const id =
          typeof parsed.id === 'string' && parsed.id ? parsed.id : path.basename(file, '.json');
        const category =
          typeof parsed.category === 'string' && parsed.category ? parsed.category : 'GENERAL';
        const errorSignature = parsed.errorSignature || parsed.task || parsed.finding || id;
        const rootCause = typeof parsed.rootCause === 'string' ? parsed.rootCause : '';
        const resolution =
          typeof parsed.resolution === 'string' ? parsed.resolution : parsed.summary || '';
        const preventionRule =
          typeof parsed.preventionRule === 'string' ? parsed.preventionRule : '';
        const affectedFiles = Array.isArray(parsed.affectedFiles)
          ? parsed.affectedFiles.map(String)
          : [];

        const parts = [`[Incident: ${category}]`, `Error Signature: ${errorSignature}`];
        if (rootCause) parts.push(`Root Cause: ${rootCause}`);
        if (resolution) parts.push(`Resolution: ${resolution}`);
        if (preventionRule) parts.push(`Prevention Rule: ${preventionRule}`);
        if (affectedFiles.length > 0) parts.push(`Affected Files: ${affectedFiles.join(', ')}`);

        upsertMemoryEntry(db, {
          id,
          key: id,
          namespace: 'retrospectives',
          content: parts.join('\n'),
          type: 'pattern',
          provenance_type: 'tool_result',
          tags: [
            'retrospective',
            category.toLowerCase(),
            retroDir.endsWith('retrospectives-archived') ? 'archived' : 'active',
          ],
          metadata: {
            category,
            errorSignature,
            rootCause,
            resolution,
            preventionRule,
            affectedFiles,
            sourceFile: filePath,
          },
        });
        seenIds.add(id);
        count++;
      } catch (e) {
        console.warn(`Could not parse retrospective ${filePath}:`, e.message);
      }
    }
  }

  for (const indexPath of indices) {
    if (!fs.existsSync(indexPath)) continue;

    try {
      const raw = fs.readFileSync(indexPath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.entries)) {
        for (const item of data.entries) {
          if (!item?.id || seenIds.has(item.id)) continue;
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
          seenIds.add(item.id);
          count++;
        }
      }
    } catch (e) {
      console.warn(`Could not parse ${indexPath}:`, e.message);
    }
  }
  return count;
}

async function syncGraphifyHubs(db) {
  const graphPath = path.join(ARCH_ROOT, 'graphify-out', 'graph.json');
  if (!fs.existsSync(graphPath)) return 0;

  try {
    const raw = fs.readFileSync(graphPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const links = Array.isArray(parsed.links)
      ? parsed.links
      : Array.isArray(parsed.edges)
        ? parsed.edges
        : [];

    const degreeMap = new Map();
    const neighborsMap = new Map();
    const labelById = new Map();
    for (const node of nodes) {
      if (node?.id) labelById.set(node.id, node.label || node.id);
    }

    for (const link of links) {
      if (!link?.source || !link?.target) continue;
      degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
      degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);

      const sList = neighborsMap.get(link.source) || [];
      if (sList.length < 8) {
        sList.push(
          `--> ${labelById.get(link.target) || link.target} [${link.relation || 'relates_to'}]`
        );
        neighborsMap.set(link.source, sList);
      }
      const tList = neighborsMap.get(link.target) || [];
      if (tList.length < 8) {
        tList.push(
          `<-- ${labelById.get(link.source) || link.source} [${link.relation || 'relates_to'}]`
        );
        neighborsMap.set(link.target, tList);
      }
    }

    const ranked = nodes
      .filter((n) => n?.id)
      .map((n) => ({ node: n, degree: degreeMap.get(n.id) || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 25);

    let count = 0;
    for (const { node, degree } of ranked) {
      const label = node.label || node.id;
      const community = node.community_name || 'architecture';
      const neighbors = neighborsMap.get(node.id) || [];
      const content = [
        `[Graphify Hub: ${label}]`,
        `File: ${node.source_file || 'doc'} (${node.source_location || 'L1'})`,
        `Community: ${community} | Degree: ${degree}`,
        neighbors.length > 0 ? `Connections:\n${neighbors.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      upsertMemoryEntry(db, {
        key: `graph-hub:${node.id}`,
        namespace: 'knowledge_graph',
        content,
        type: 'structural',
        provenance_type: 'tool_result',
        tags: ['graphify', 'hub', community],
        metadata: {
          nodeId: node.id,
          label,
          sourceFile: node.source_file,
          sourceLocation: node.source_location,
          community,
          degree,
        },
      });
      count++;
    }
    return count;
  } catch (e) {
    console.warn('Could not sync Graphify hubs:', e.message);
    return 0;
  }
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

    const graphHubCount = await syncGraphifyHubs(db);
    console.log(`   ✓ Synced ${graphHubCount} Graphify hub nodes`);

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
