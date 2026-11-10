#!/usr/bin/env node
/**
 * tools/scripts/compact-context.cjs
 *
 * Two-stage Context Compaction & State-Spine Consolidation Engine for `/compact`
 * (`pnpm compact` / `--mode standard`) and `/compact/compact` (`pnpm compact:deep` / `--mode deep`).
 *
 * Implements:
 * 1. Empirical SQLite & JSONL Telemetry Reader (Antigravity conversation DB + transcript.jsonl)
 * 2. Double-Compaction Cache Guard (`< 25%` fill or `/compact/compact` -> `consolidate_state_spine`)
 * 3. Google/Purdue `SKILL.state` Bounded O(1) JSON Spine (`<= 4,000` chars)
 * 4. 6-Section Artifact Trail Extractor (`Created`, `Modified`, `Inspected [DO NOT RE-READ]`,
 *    `Decisions`, `Verification Ledger`, `Next Actions`)
 * 5. Atomic Persistence to `.handoff/handoff.{md,json}`, `<artifactDir>/HANDOFF.md`,
 *    `.remember/now.md`, and `.agents/memory_base/retrospectives/`
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const AGY_ROOT = path.join(os.homedir(), '.gemini', 'antigravity-cli');
const CONVERSATIONS_DIR = path.join(AGY_ROOT, 'conversations');
const BRAIN_DIR = path.join(AGY_ROOT, 'brain');
const HANDOFF_DIR = path.join(WORKSPACE_ROOT, '.handoff');
const REMEMBER_DIR = path.join(WORKSPACE_ROOT, '.remember');
const RETROSPECTIVES_DIR = path.join(WORKSPACE_ROOT, '.agents', 'memory_base', 'retrospectives');

const DEFAULT_CONTEXT_WINDOW_LIMIT = 256_000;
const COMPACTION_IDEMPOTENT_FLOOR = 0.25;
const PROACTIVE_HANDOFF_THRESHOLD = 0.7;
const MIN_TURNS_BETWEEN_COMPACTIONS = 4;
const MAX_COMPACTION_STATE_CHARS = 4_000;
const MAX_INSPECTED_FILES = 25;
const MAX_MODIFIED_FILES = 25;
const MAX_VERIFICATION_ENTRIES = 8;

function parseCliOptions(argv) {
  let mode = 'standard';
  let conversationId = process.env.AGY_CONVERSATION_ID || '';
  let isHook = false;
  let isQuiet = false;

  for (let idx = 2; idx < argv.length; idx += 1) {
    const arg = argv[idx];
    if (arg === '--mode' && argv[idx + 1]) {
      mode = argv[idx + 1];
      idx += 1;
    } else if (arg.startsWith('--mode=')) {
      mode = arg.split('=')[1] || 'standard';
    } else if (arg === '--conversation' && argv[idx + 1]) {
      conversationId = argv[idx + 1];
      idx += 1;
    } else if (arg === '--hook') {
      isHook = true;
    } else if (arg === '--quiet') {
      isQuiet = true;
    }
  }

  const normalizedMode = mode === 'deep' || mode === 'compact/compact' ? 'deep' : 'standard';
  return { mode: normalizedMode, conversationId, isHook, isQuiet };
}

function resolveLatestConversationId(explicitId) {
  if (explicitId) {
    const candidateDb = path.join(CONVERSATIONS_DIR, `${explicitId}.db`);
    if (fs.existsSync(candidateDb)) return explicitId;
  }

  if (!fs.existsSync(CONVERSATIONS_DIR)) return '';

  const entries = fs
    .readdirSync(CONVERSATIONS_DIR)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      const fullPath = path.join(CONVERSATIONS_DIR, name);
      const stat = fs.statSync(fullPath);
      return { id: name.replace(/\.db$/, ''), mtimeMs: stat.mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return entries[0]?.id || '';
}

function queryConversationDbMetrics(conversationId) {
  const defaultMetrics = {
    totalGenerations: 0,
    latestInputTokens: 0,
    latestCachedTokens: 0,
    latestUncachedTokens: 0,
    peakContextTokens: 0,
    cumulativeInputTokens: 0,
    cumulativeCachedTokens: 0,
    cacheHitRatio: 0,
  };

  if (!conversationId) return defaultMetrics;
  const dbPath = path.join(CONVERSATIONS_DIR, `${conversationId}.db`);
  if (!fs.existsSync(dbPath)) return defaultMetrics;

  const pythonScript = `
import json, pathlib, sys
sys.path.insert(0, '/home/tim/.gemini/config/plugins/token-optimizer')
import antigravity_state as ags
data = ags.read_conversation(pathlib.Path(sys.argv[1]))
if not data or not data.get('generations'):
    print(json.dumps({}))
    sys.exit(0)
gens = data['generations']
last = gens[-1]
last_used = int(last.get('estimated_tokens_used', 0)) or (int(last.get('input_tokens', 0)) + int(last.get('cache_read_tokens', 0)))
last_cache = int(last.get('cache_read_tokens', 0))
last_in = int(last.get('input_tokens', 0))
tot = data.get('totals', {})
tot_in = int(tot.get('input_tokens', 0))
tot_cache = int(tot.get('cache_read_tokens', 0))
peak = max(int(g.get('estimated_tokens_used', 0)) for g in gens)
denom = tot_in + tot_cache
print(json.dumps({
    'totalGenerations': len(gens),
    'latestInputTokens': last_used,
    'latestCachedTokens': last_cache,
    'latestUncachedTokens': last_in,
    'peakContextTokens': peak,
    'cumulativeInputTokens': tot_in,
    'cumulativeCachedTokens': tot_cache,
    'cacheHitRatio': round((tot_cache / denom) if denom > 0 else 0.0, 4),
}))
`;

  try {
    const stdout = execFileSync('python3', ['-c', pythonScript, dbPath], {
      encoding: 'utf8',
      timeout: 4_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(stdout.trim() || '{}');
    return { ...defaultMetrics, ...parsed };
  } catch {
    return defaultMetrics;
  }
}

function extractArtifactTrailFromTranscript(conversationId) {
  const trail = {
    checkpointCount: 0,
    turnsSinceLastCheckpoint: 99,
    createdFiles: [],
    modifiedFiles: [],
    inspectedFiles: [],
    verificationCommands: [],
    recentUserPrompts: [],
  };

  if (!conversationId) return trail;
  const transcriptPath = path.join(
    BRAIN_DIR,
    conversationId,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  );
  if (!fs.existsSync(transcriptPath)) return trail;

  const createdSet = new Set();
  const modifiedSet = new Set();
  const inspectedSet = new Set();
  const commands = [];
  const prompts = [];

  const rawLines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  let lastCheckpointIdx = -1;

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    let step;
    try {
      step = JSON.parse(rawLines[idx]);
    } catch {
      continue;
    }

    if (step.type === 'CHECKPOINT') {
      trail.checkpointCount += 1;
      lastCheckpointIdx = idx;
      continue;
    }

    if (step.type === 'USER_INPUT' && typeof step.content === 'string') {
      const cleaned = step.content
        .replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '')
        .trim()
        .slice(0, 140);
      if (cleaned) prompts.push(cleaned);
    }

    const toolCalls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
    for (const call of toolCalls) {
      const toolName = call.name || '';
      const args = call.arguments || call.args || {};
      const filePath = typeof args.Path === 'string' ? args.Path : '';
      const normalizedPath = filePath.startsWith(WORKSPACE_ROOT)
        ? path.relative(WORKSPACE_ROOT, filePath)
        : filePath;

      if (toolName.endsWith('write_file') && normalizedPath) {
        createdSet.add(normalizedPath);
      } else if (toolName.endsWith('edit_file') && normalizedPath) {
        modifiedSet.add(normalizedPath);
      } else if (toolName.endsWith('read_file') && normalizedPath) {
        inspectedSet.add(normalizedPath);
      } else if (toolName.endsWith('run_command') && typeof args.toolSummary === 'string') {
        commands.push(args.toolSummary);
      }
    }
  }

  trail.turnsSinceLastCheckpoint =
    lastCheckpointIdx >= 0 ? Math.max(0, rawLines.length - 1 - lastCheckpointIdx) : rawLines.length;
  trail.createdFiles = Array.from(createdSet).slice(-MAX_MODIFIED_FILES);
  trail.modifiedFiles = Array.from(modifiedSet).slice(-MAX_MODIFIED_FILES);
  trail.inspectedFiles = Array.from(inspectedSet)
    .filter((file) => !createdSet.has(file) && !modifiedSet.has(file))
    .slice(-MAX_INSPECTED_FILES);
  trail.verificationCommands = commands.slice(-MAX_VERIFICATION_ENTRIES);
  trail.recentUserPrompts = prompts.slice(-4);

  return trail;
}

function getGitWorkspaceStatus() {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const headSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const statusRaw = execFileSync('git', ['status', '--porcelain'], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const dirtyFiles = statusRaw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_MODIFIED_FILES);
    return { branch, headSha, dirtyFiles };
  } catch {
    return { branch: 'unknown', headSha: 'unknown', dirtyFiles: [] };
  }
}

function evaluateDoubleCompaction(metrics, trail, mode) {
  const usageRatio =
    metrics.latestInputTokens > 0
      ? Number((metrics.latestInputTokens / DEFAULT_CONTEXT_WINDOW_LIMIT).toFixed(4))
      : 0;
  const isDoubleSlash = mode === 'deep';
  const isBelowFloor = usageRatio > 0 && usageRatio < COMPACTION_IDEMPOTENT_FLOOR;
  const isRecent = trail.turnsSinceLastCheckpoint < MIN_TURNS_BETWEEN_COMPACTIONS;

  if (isDoubleSlash || isBelowFloor || isRecent) {
    return {
      decision: 'consolidate_state_spine',
      usageRatio,
      avoidedCacheRebuildTokens: metrics.latestCachedTokens || metrics.latestInputTokens,
      shouldRunDeepMemorySweep: Boolean(isDoubleSlash || isBelowFloor),
      reason: isDoubleSlash
        ? '/compact/compact deep mode: consolidating bounded SKILL.state spine and pruning duplicate retrospectives without invalidating warm LLM prefix cache.'
        : 'Context fill is below 25% idempotent floor or within 4 turns of prior checkpoint; preserving warm prefix cache.',
    };
  }

  return {
    decision: 'execute_full_compact',
    usageRatio,
    avoidedCacheRebuildTokens: 0,
    shouldRunDeepMemorySweep: usageRatio >= PROACTIVE_HANDOFF_THRESHOLD,
    reason:
      'Context fill exceeds 25% floor and turn spacing; full compaction + handoff spine enabled.',
  };
}

function buildBoundedSkillState(existingState, gitInfo, metrics, guardVerdict, trail) {
  const candidate = {
    ...existingState,
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    branch: gitInfo.branch,
    headSha: gitInfo.headSha,
    compactionDecision: guardVerdict.decision,
    contextFillRatio: guardVerdict.usageRatio,
    latestInputTokens: metrics.latestInputTokens,
    cacheHitRatio: metrics.cacheHitRatio,
    checkpointCount: trail.checkpointCount,
    activeDirtyCount: gitInfo.dirtyFiles.length,
    recentGoal:
      trail.recentUserPrompts[trail.recentUserPrompts.length - 1] || 'Active engineering task',
  };

  let serialized = JSON.stringify(candidate);
  if (serialized.length > MAX_COMPACTION_STATE_CHARS) {
    delete candidate.recentGoal;
    serialized = JSON.stringify(candidate);
  }
  return { state: candidate, serializedChars: serialized.length };
}

function formatHandoffMarkdown(payload) {
  const { generatedAt, conversationId, mode, gitInfo, metrics, guardVerdict, trail, skillState } =
    payload;

  const createdList =
    trail.createdFiles.length > 0
      ? trail.createdFiles.map((item) => `- \`${item}\``).join('\n')
      : '- None in current window';
  const modifiedList =
    trail.modifiedFiles.length > 0
      ? trail.modifiedFiles.map((item) => `- \`${item}\``).join('\n')
      : gitInfo.dirtyFiles.length > 0
        ? gitInfo.dirtyFiles.map((item) => `- \`${item}\``).join('\n')
        : '- Clean working tree';
  const inspectedList =
    trail.inspectedFiles.length > 0
      ? trail.inspectedFiles.map((item) => `- \`${item}\` [DO NOT RE-READ]`).join('\n')
      : '- None recorded';
  const verificationList =
    trail.verificationCommands.length > 0
      ? trail.verificationCommands.map((item) => `- ${item}`).join('\n')
      : '- Pending `pnpm agent:verify`';

  return `# SESSION HANDOFF & COMPACTION SPINE (${mode.toUpperCase()})

- **Timestamp**: \`${generatedAt}\`
- **Conversation ID**: \`${conversationId || 'local-cli'}\`
- **Branch / HEAD**: \`${gitInfo.branch}\` (\`${gitInfo.headSha}\`)
- **Compaction Verdict**: \`${guardVerdict.decision}\` (${guardVerdict.reason})
- **Live Context Fill**: \`${metrics.latestInputTokens.toLocaleString()} / ${DEFAULT_CONTEXT_WINDOW_LIMIT.toLocaleString()}\` tokens (\`${(guardVerdict.usageRatio * 100).toFixed(1)}%\`)
- **Prefix Cache Hit Ratio**: \`${(metrics.cacheHitRatio * 100).toFixed(1)}%\` (Avoided Rebuild: \`${guardVerdict.avoidedCacheRebuildTokens.toLocaleString()}\` tokens)

## 1. Bounded SKILL.state Spine (O(1) <= ${MAX_COMPACTION_STATE_CHARS} chars)

\`\`\`json
${JSON.stringify(skillState.state, null, 2)}
\`\`\`

## 2. Created Files (Artifact Trail)

${createdList}

## 3. Modified Files (Artifact Trail)

${modifiedList}

## 4. Inspected Read-Only Files ([DO NOT RE-READ])

${inspectedList}

## 5. Verification Ledger

${verificationList}

## 6. Next Actions & Post-Compaction Protocol

- Resume directly from the bounded \`SKILL.state\` spine above without re-reading files marked \`[DO NOT RE-READ]\`.
- Use line-bounded \`read_file\` (\`StartLine\`/\`EndLine\`) or \`ast-grep\` (\`sg\`) if a symbol signature must be checked.
`;
}

function atomicWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function runDeepMemorySweep() {
  const actions = [];
  const cleanupScript = path.join(WORKSPACE_ROOT, 'tools/scripts/retrospective-cleanup.cjs');
  if (fs.existsSync(cleanupScript)) {
    try {
      execFileSync(process.execPath, [cleanupScript, '--remove-duplicates'], {
        cwd: WORKSPACE_ROOT,
        stdio: 'ignore',
        timeout: 10_000,
      });
      actions.push('retrospective-cleanup:deduped');
    } catch {
      actions.push('retrospective-cleanup:skipped');
    }
  }

  const indexerScript = path.join(WORKSPACE_ROOT, 'tools/scripts/smart-indexer.cjs');
  if (fs.existsSync(indexerScript)) {
    try {
      execFileSync(process.execPath, [indexerScript], {
        cwd: WORKSPACE_ROOT,
        stdio: 'ignore',
        timeout: 15_000,
      });
      const indexJsonPath = path.join(WORKSPACE_ROOT, '.agents', 'memory_base', 'index.json');
      if (fs.existsSync(indexJsonPath)) {
        const rawIdx = fs.readFileSync(indexJsonPath, 'utf8');
        if (!rawIdx.endsWith('\n')) {
          atomicWriteFile(indexJsonPath, `${rawIdx}\n`);
        }
      }
      actions.push('smart-indexer:synced');
    } catch {
      actions.push('smart-indexer:skipped');
    }
  }

  const logsDir = path.join(WORKSPACE_ROOT, '.agents', 'logs');
  if (fs.existsSync(logsDir)) {
    for (const name of fs.readdirSync(logsDir)) {
      if (!name.endsWith('.jsonl')) continue;
      const logPath = path.join(logsDir, name);
      const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
      if (lines.length > 2_000) {
        atomicWriteFile(logPath, `${lines.slice(-500).join('\n')}\n`);
        actions.push(`log-pruned:${name}`);
      }
    }
  }

  return actions;
}

function main() {
  const options = parseCliOptions(process.argv);
  const conversationId = resolveLatestConversationId(options.conversationId);
  const generatedAt = new Date().toISOString();

  const metrics = queryConversationDbMetrics(conversationId);
  const trail = extractArtifactTrailFromTranscript(conversationId);
  const gitInfo = getGitWorkspaceStatus();
  const guardVerdict = evaluateDoubleCompaction(metrics, trail, options.mode);

  const handoffJsonPath = path.join(HANDOFF_DIR, 'handoff.json');
  let existingSkillState = {};
  if (fs.existsSync(handoffJsonPath)) {
    try {
      const prior = JSON.parse(fs.readFileSync(handoffJsonPath, 'utf8'));
      if (prior?.skillState && typeof prior.skillState.state === 'object') {
        existingSkillState = { ...prior.skillState.state };
        delete existingSkillState.state;
        delete existingSkillState.serializedChars;
      }
    } catch {
      existingSkillState = {};
    }
  }

  const skillState = buildBoundedSkillState(
    existingSkillState,
    gitInfo,
    metrics,
    guardVerdict,
    trail
  );

  const deepSweepActions =
    options.mode === 'deep' || guardVerdict.shouldRunDeepMemorySweep ? runDeepMemorySweep() : [];

  const handoffPayload = {
    schemaVersion: '1.0.0',
    generatedAt,
    conversationId,
    mode: options.mode,
    gitInfo,
    metrics,
    guardVerdict,
    trail,
    skillState,
    deepSweepActions,
  };

  const markdown = formatHandoffMarkdown(handoffPayload);
  atomicWriteFile(path.join(HANDOFF_DIR, 'handoff.md'), markdown);
  atomicWriteFile(handoffJsonPath, `${JSON.stringify(handoffPayload, null, 2)}\n`);
  atomicWriteFile(path.join(REMEMBER_DIR, 'now.md'), markdown);

  if (conversationId) {
    const artifactDir = path.join(BRAIN_DIR, conversationId);
    if (fs.existsSync(artifactDir)) {
      atomicWriteFile(path.join(artifactDir, 'HANDOFF.md'), markdown);
    }

    if (fs.existsSync(RETROSPECTIVES_DIR)) {
      const shortId = conversationId.slice(0, 8);
      const retroPath = path.join(RETROSPECTIVES_DIR, `compaction-${shortId}.json`);
      const retroPayload = {
        id: `compaction-${shortId}`,
        timestamp: generatedAt,
        taskTag: `compaction-${options.mode}-${shortId}`,
        category: 'context-compaction',
        errorSignature: `compaction_decision:${guardVerdict.decision}`,
        affectedFiles: [...trail.createdFiles, ...trail.modifiedFiles].slice(0, 15),
        rootCause: guardVerdict.reason,
        resolution: `Persisted bounded SKILL.state (${skillState.serializedChars} chars) and 6-Section Artifact Trail to .handoff/handoff.{md,json}`,
        preventionRule:
          'Always persist .handoff/handoff.{md,json} at >= 70% fill and route /compact/compact (< 25% fill) through consolidate_state_spine to preserve warm LLM prefix cache.',
        metrics: {
          mode: options.mode,
          decision: guardVerdict.decision,
          latestInputTokens: metrics.latestInputTokens,
          cacheHitRatio: metrics.cacheHitRatio,
          checkpointCount: trail.checkpointCount,
          avoidedCacheRebuildTokens: guardVerdict.avoidedCacheRebuildTokens,
        },
      };
      atomicWriteFile(retroPath, `${JSON.stringify(retroPayload, null, 2)}\n`);
    }
  }

  if (!options.isQuiet) {
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          mode: options.mode,
          conversationId: conversationId || 'local-cli',
          decision: guardVerdict.decision,
          usageRatio: guardVerdict.usageRatio,
          latestInputTokens: metrics.latestInputTokens,
          cacheHitRatio: metrics.cacheHitRatio,
          avoidedCacheRebuildTokens: guardVerdict.avoidedCacheRebuildTokens,
          skillStateChars: skillState.serializedChars,
          deepSweepActions,
          persisted: [
            '.handoff/handoff.md',
            '.handoff/handoff.json',
            '.remember/now.md',
            conversationId ? `<artifactDir>/HANDOFF.md` : null,
          ].filter(Boolean),
        },
        null,
        2
      )
    );
  }
}

main();
