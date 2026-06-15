#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const CONFLICT_DIR = path.join(PROJ, '.kiro', 'conflict');

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function loadState() {
  const file = path.join(CONFLICT_DIR, 'conflicts.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { conflicts: [], resolutions: [] }; }
}

function saveState(state) {
  try {
    if (!fs.existsSync(CONFLICT_DIR)) fs.mkdirSync(CONFLICT_DIR, { recursive: true });
    fs.writeFileSync(path.join(CONFLICT_DIR, 'conflicts.json'), JSON.stringify(state, null, 2));
  } catch {}
}

function detectConflicts(changes) {
  const fileChanges = {};
  for (const change of changes) {
    const file = change.file || change.file_path || '';
    if (!fileChanges[file]) fileChanges[file] = [];
    fileChanges[file].push(change);
  }

  const conflicts = [];
  for (const [file, edits] of Object.entries(fileChanges)) {
    if (edits.length > 1) {
      const overlapping = edits.filter(e => {
        const range = e.range || e.lines || null;
        if (!range) return true;
        return true;
      });
      if (overlapping.length > 1) {
        conflicts.push({
          file,
          id: `conflict_${Date.now()}_${hash(file)}`,
          changes: overlapping,
          detected_at: new Date().toISOString(),
          status: 'pending'
        });
      }
    }
  }
  return conflicts;
}

function threeWayMerge(original, changeA, changeB) {
  const linesA = changeA.split('\n');
  const linesB = changeB.split('\n');
  const originalLines = original.split('\n');

  let result = [];
  let conflicts = [];
  let i = 0, j = 0, k = 0;

  while (i < originalLines.length || j < linesA.length || k < linesB.length) {
    const origLine = i < originalLines.length ? originalLines[i] : null;
    const lineA = j < linesA.length ? linesA[j] : null;
    const lineB = k < linesB.length ? linesB[k] : null;

    if (origLine === null && lineA === null && lineB === null) break;

    if (lineA === lineB) {
      if (lineA !== null) result.push(lineA);
      if (origLine !== null) i++;
      if (lineA !== null) j++;
      if (lineB !== null) k++;
    } else if (lineA === origLine && lineB !== null && lineB !== origLine) {
      result.push(lineB);
      if (origLine !== null) i++;
      if (lineA !== null) j++;
      k++;
    } else if (lineB === origLine && lineA !== null && lineA !== origLine) {
      result.push(lineA);
      if (origLine !== null) i++;
      j++;
      if (lineB !== null) k++;
    } else if (lineA === null && lineB !== null) {
      result.push(lineB);
      k++;
    } else if (lineB === null && lineA !== null) {
      result.push(lineA);
      j++;
    } else {
      conflicts.push({
        position: result.length,
        original: origLine || '',
        changeA: lineA || '',
        changeB: lineB || ''
      });
      result.push(`<<<<<<< change-a`);
      if (lineA !== null) result.push(lineA);
      result.push('=======');
      if (lineB !== null) result.push(lineB);
      result.push(`>>>>>>> change-b`);
      if (origLine !== null) i++;
      if (lineA !== null) j++;
      if (lineB !== null) k++;
    }
  }

  return { merged: result.join('\n'), conflicts };
}

async function arbitrate(conflict, context = {}) {
  const resolution = {
    conflict_id: conflict.id,
    file: conflict.file,
    resolved_at: new Date().toISOString(),
    strategy: 'auto_merge',
    status: 'resolved',
    confidence: 1.0,
    merged_content: null
  };

  let original = '';
  try {
    const fullPath = path.isAbsolute(conflict.file)
      ? conflict.file
      : path.join(PROJ, conflict.file);
    if (fs.existsSync(fullPath)) {
      original = fs.readFileSync(fullPath, 'utf8');
    }
  } catch {}

  const changeA = conflict.changes[0]?.content || '';
  const changeB = conflict.changes[1]?.content || '';

  if (original && changeA && changeB) {
    const merge = threeWayMerge(original, changeA, changeB);
    resolution.merged_content = merge.merged;
    resolution.confidence = merge.conflicts.length === 0 ? 1.0 : 0.5;
    resolution.conflict_count = merge.conflicts.length;
    resolution.strategy = merge.conflicts.length === 0 ? 'auto_merge' : 'marked_conflicts';

    if (resolution.confidence < 0.7) {
      resolution.status = 'needs_review';
      resolution.review_branch = `conflict/${conflict.file.replace(/[^a-zA-Z0-9]/g, '-')}-${hash(original)}`;
      try {
        execSync(`cd "${PROJ}" && git checkout -b "${resolution.review_branch}" 2>/dev/null`, { stdio: 'ignore' });
        fs.writeFileSync(path.join(PROJ, conflict.file), resolution.merged_content);
        execSync(`cd "${PROJ}" && git add "${conflict.file}" && git commit -m "conflict: ${conflict.file} needs review" 2>/dev/null`, { stdio: 'ignore' });
        execSync(`cd "${PROJ}" && git checkout - 2>/dev/null`, { stdio: 'ignore' });
      } catch {}
    }
  } else {
    resolution.strategy = 'first_wins';
    resolution.merged_content = changeA || changeB;
    resolution.status = 'resolved';
  }

  const state = loadState();
  state.resolutions.push(resolution);
  if (state.resolutions.length > 100) state.resolutions.shift();
  saveState(state);

  return resolution;
}

async function main() {
  const cmd = process.argv[2] || 'detect';

  switch (cmd) {
    case 'detect': {
      let raw = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', d => { raw += d; });
      process.stdin.on('end', async () => {
        try {
          const input = JSON.parse(raw || '{"changes":[]}');
          const conflicts = detectConflicts(input.changes || []);
          console.log(JSON.stringify({ conflicts, count: conflicts.length }, null, 2));
        } catch (err) {
          console.error(JSON.stringify({ error: err.message }));
          process.exit(1);
        }
      });
      break;
    }

    case 'arbitrate': {
      let raw = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', d => { raw += d; });
      process.stdin.on('end', async () => {
        try {
          const input = JSON.parse(raw || '{}');
          const resolution = await arbitrate(input.conflict || input, input.context || {});
          console.log(JSON.stringify(resolution, null, 2));
        } catch (err) {
          console.error(JSON.stringify({ error: err.message }));
          process.exit(1);
        }
      });
      break;
    }

    case 'status': {
      const state = loadState();
      const pending = state.conflicts.filter(c => c.status === 'pending');
      const resolved = state.resolutions;
      console.log(JSON.stringify({
        pending_conflicts: pending.length,
        total_resolved: resolved.length,
        recent: resolved.slice(-5).map(r => ({
          file: r.file,
          strategy: r.strategy,
          status: r.status,
          confidence: r.confidence,
          resolved_at: r.resolved_at
        }))
      }, null, 2));
      break;
    }

    default:
      console.log('Commands: detect | arbitrate | status');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { detectConflicts, threeWayMerge, arbitrate };
