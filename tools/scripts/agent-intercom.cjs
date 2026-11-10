#!/usr/bin/env node

/**
 * @file tools/scripts/agent-intercom.cjs
 * @description Agent Intercom, Whiteboard, and File Claim CLI Manager.
 * Enables concurrent autonomous agents to claim file locks, broadcast intercom messages,
 * and update the shared whiteboard canvas without overlapping edits.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const WHITEBOARD_DIR = path.join(ROOT_DIR, '.agents', 'a2a', 'whiteboard');
const CLAIMS_FILE = path.join(WHITEBOARD_DIR, 'claims.json');
const INTERCOM_FILE = path.join(WHITEBOARD_DIR, 'intercom.jsonl');
const CANVAS_FILE = path.join(WHITEBOARD_DIR, 'canvas.md');

const DEFAULT_CLAIM_TTL_MS = 1_800_000; // 30 minutes
const ACTION_CLAIM = 'claim';
const ACTION_RELEASE = 'release';
const ACTION_TALK = 'talk';
const ACTION_LIST = 'list';
const ACTION_CANVAS = 'canvas';

/**
 * Ensures whiteboard directory and SSoT files exist.
 */
function ensureWhiteboardStorage() {
  if (!fs.existsSync(WHITEBOARD_DIR)) {
    fs.mkdirSync(WHITEBOARD_DIR, { recursive: true });
  }
  if (!fs.existsSync(CLAIMS_FILE)) {
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify({ activeClaims: [] }, null, 2) + '\n', 'utf8');
  }
  if (!fs.existsSync(INTERCOM_FILE)) {
    fs.writeFileSync(INTERCOM_FILE, '', 'utf8');
  }
  if (!fs.existsSync(CANVAS_FILE)) {
    fs.writeFileSync(
      CANVAS_FILE,
      '# 🎨 Active Agent Whiteboard\n\n## 🚀 Active Swarm Tasks\n',
      'utf8'
    );
  }
}

/**
 * Reads and parses claims.json.
 * @returns {{ activeClaims: Array<{ agentId: string, filePath: string, acquiredAt: string, expiresAt: string, intent: string }> }}
 */
function readClaimsData() {
  ensureWhiteboardStorage();
  try {
    const rawContent = fs.readFileSync(CLAIMS_FILE, 'utf8');
    const parsed = JSON.parse(rawContent);
    return { activeClaims: Array.isArray(parsed.activeClaims) ? parsed.activeClaims : [] };
  } catch (error) {
    throw new Error('Failed to read whiteboard claims file', { cause: error });
  }
}

/**
 * Writes claims data back to claims.json.
 * @param {{ activeClaims: Array<unknown> }} claimsData
 */
function writeClaimsData(claimsData) {
  ensureWhiteboardStorage();
  try {
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claimsData, null, 2) + '\n', 'utf8');
  } catch (error) {
    throw new Error('Failed to write whiteboard claims file', { cause: error });
  }
}

/**
 * Prunes expired claims based on current time.
 */
function pruneExpiredClaims() {
  const claimsStore = readClaimsData();
  const nowMs = Date.now();
  const validClaims = claimsStore.activeClaims.filter((claimEntry) => {
    const expiresMs = new Date(claimEntry.expiresAt).getTime();
    return Number.isFinite(expiresMs) && expiresMs > nowMs;
  });

  if (validClaims.length !== claimsStore.activeClaims.length) {
    writeClaimsData({ activeClaims: validClaims });
  }
}

/**
 * Claims a file lock for an agent.
 * @param {{ agentId: string, filePath: string, intent?: string, ttlMs?: number }} options
 */
function acquireFileClaim(options) {
  const { agentId, filePath, intent = 'Editing code', ttlMs = DEFAULT_CLAIM_TTL_MS } = options;
  if (!agentId || !filePath) {
    throw new Error('Both agentId and filePath are required to acquire a claim.');
  }

  pruneExpiredClaims();
  const claimsStore = readClaimsData();
  const normalizedPath = filePath.split(path.sep).join('/').replace(/^\.\//, '');

  const existingClaim = claimsStore.activeClaims.find((entry) => entry.filePath === normalizedPath);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  if (existingClaim) {
    if (existingClaim.agentId === agentId) {
      existingClaim.expiresAt = expiresAt;
      existingClaim.intent = intent;
      writeClaimsData(claimsStore);
      process.stdout.write(
        `✅ Renewed claim on ${normalizedPath} for agent ${agentId} until ${expiresAt}\n`
      );
      return;
    }
    throw new Error(
      `Conflict: File ${normalizedPath} is currently claimed by agent '${existingClaim.agentId}' (Intent: ${existingClaim.intent}, Expires: ${existingClaim.expiresAt})`
    );
  }

  claimsStore.activeClaims.push({
    agentId,
    filePath: normalizedPath,
    acquiredAt: now.toISOString(),
    expiresAt,
    intent,
  });
  writeClaimsData(claimsStore);
  process.stdout.write(`✅ Claim acquired on ${normalizedPath} for agent ${agentId}\n`);
}

/**
 * Releases a file claim for an agent.
 * @param {{ agentId: string, filePath: string }} options
 */
function releaseFileClaim(options) {
  const { agentId, filePath } = options;
  if (!agentId || !filePath) {
    throw new Error('Both agentId and filePath are required to release a claim.');
  }

  const claimsStore = readClaimsData();
  const normalizedPath = filePath.split(path.sep).join('/').replace(/^\.\//, '');

  const initialCount = claimsStore.activeClaims.length;
  const filteredClaims = claimsStore.activeClaims.filter(
    (entry) => !(entry.filePath === normalizedPath && entry.agentId === agentId)
  );

  if (filteredClaims.length === initialCount) {
    process.stdout.write(`⚠️ No active claim found for agent '${agentId}' on ${normalizedPath}\n`);
    return;
  }

  writeClaimsData({ activeClaims: filteredClaims });
  process.stdout.write(`✅ Released claim on ${normalizedPath} for agent ${agentId}\n`);
}

/**
 * Broadcasts an intercom message to intercom.jsonl.
 * @param {{ sender: string, recipient?: string, messageType?: string, content: string }} options
 */
function broadcastIntercomMessage(options) {
  const { sender, recipient = 'ALL', messageType = 'BROADCAST', content } = options;
  if (!sender || !content) {
    throw new Error('Both sender and content are required for intercom messages.');
  }

  ensureWhiteboardStorage();
  const envelope = {
    timestamp: new Date().toISOString(),
    sender,
    recipient,
    messageType,
    content,
  };

  try {
    fs.appendFileSync(INTERCOM_FILE, JSON.stringify(envelope) + '\n', 'utf8');
    process.stdout.write(
      `💬 Intercom broadcast sent from [${sender}] to [${recipient}]: ${content}\n`
    );
  } catch (error) {
    throw new Error('Failed to append intercom message', { cause: error });
  }
}

/**
 * Lists active claims and recent intercom messages.
 */
function listWhiteboardStatus() {
  pruneExpiredClaims();
  const claimsStore = readClaimsData();
  process.stdout.write('\n=== 🔒 ACTIVE FILE CLAIMS ===\n');
  if (claimsStore.activeClaims.length === 0) {
    process.stdout.write('  (No active file claims)\n');
  } else {
    claimsStore.activeClaims.forEach((claim) => {
      process.stdout.write(
        `  • [${claim.agentId}] claimed '${claim.filePath}' (Intent: ${claim.intent}, Expires: ${claim.expiresAt})\n`
      );
    });
  }

  ensureWhiteboardStorage();
  const intercomLines = fs.readFileSync(INTERCOM_FILE, 'utf8').trim().split('\n').filter(Boolean);

  process.stdout.write('\n=== 💬 RECENT INTERCOM MESSAGES ===\n');
  const recentLines = intercomLines.slice(-10);
  if (recentLines.length === 0) {
    process.stdout.write('  (No intercom messages recorded)\n');
  } else {
    recentLines.forEach((line) => {
      try {
        const msg = JSON.parse(line);
        process.stdout.write(
          `  [${msg.timestamp}] ${msg.sender} → ${msg.recipient} (${msg.messageType}): ${msg.content}\n`
        );
      } catch {
        process.stdout.write(`  ${line}\n`);
      }
    });
  }
  process.stdout.write('\n');
}

/**
 * CLI argument parser and execution dispatcher.
 */
function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action || action === '--help' || action === '-h') {
    process.stdout.write(`
Agent Intercom & Whiteboard CLI Manager

Usage:
  node tools/scripts/agent-intercom.cjs claim <agentId> <filePath> [intent]
  node tools/scripts/agent-intercom.cjs release <agentId> <filePath>
  node tools/scripts/agent-intercom.cjs talk <sender> <content> [recipient] [messageType]
  node tools/scripts/agent-intercom.cjs list
`);
    process.exit(0);
  }

  switch (action) {
    case ACTION_CLAIM: {
      const [, agentId, filePath, intent] = args;
      acquireFileClaim({ agentId, filePath, intent });
      break;
    }
    case ACTION_RELEASE: {
      const [, agentId, filePath] = args;
      releaseFileClaim({ agentId, filePath });
      break;
    }
    case ACTION_TALK: {
      const [, sender, content, recipient, messageType] = args;
      broadcastIntercomMessage({ sender, content, recipient, messageType });
      break;
    }
    case ACTION_LIST:
    case 'status': {
      listWhiteboardStatus();
      break;
    }
    default: {
      console.error(`Unknown action: ${action}`);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      `[agent-intercom] Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

module.exports = {
  acquireFileClaim,
  releaseFileClaim,
  broadcastIntercomMessage,
  readClaimsData,
  pruneExpiredClaims,
};
