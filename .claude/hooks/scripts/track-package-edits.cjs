#!/usr/bin/env node
/**
 * track-package-edits: PostToolUse hook
 *
 * Tracks edits to source files in apps/* and packages/* so that Stop hooks
 * can enforce AGENT_TRACER.md updates and run knip for dead-code detection.
 *
 * Writes per-session state to /tmp/pro-workflow/ using the session ID
 * from the CLAUDE_CODE_SESSION_ID environment variable.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function getTempDir() {
  return path.join(os.tmpdir(), "pro-workflow");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => {
      data += c;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

function getSessionId() {
  return process.env.CLAUDE_SESSION_ID || String(process.ppid) || "default";
}

function extractPackageRoot(filePath) {
  const match = filePath.match(/^(apps\/[^/]+|packages\/[^/]+)/);
  return match ? match[1] : null;
}

(async () => {
  const raw = await readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const filePath =
    input?.tool_response?.filePath ||
    input?.tool_input?.file_path ||
    input?.tool_input?.TargetFile ||
    "";

  if (!filePath) process.exit(0);

  const pkgRoot = extractPackageRoot(filePath);
  if (!pkgRoot) process.exit(0);

  const tempDir = getTempDir();
  ensureDir(tempDir);
  const sessionId = getSessionId();

  // Track all unique edited files (for knip threshold)
  const allEditsFile = path.join(tempDir, `all-edits-${sessionId}.txt`);
  const seen = new Set();
  if (fs.existsSync(allEditsFile)) {
    const lines = fs.readFileSync(allEditsFile, "utf8").split("\n");
    for (const line of lines) {
      if (line.trim()) seen.add(line.trim());
    }
  }
  if (!seen.has(filePath)) {
    fs.appendFileSync(allEditsFile, filePath + "\n");
  }

  // Track source edits per package (for AGENT_TRACER enforcement)
  const sourceEditsFile = path.join(tempDir, `source-edits-${sessionId}.json`);
  let sourceEdits = {};
  if (fs.existsSync(sourceEditsFile)) {
    try {
      sourceEdits = JSON.parse(fs.readFileSync(sourceEditsFile, "utf8"));
    } catch {}
  }

  // Track AGENT_TRACER.md edits per package
  const tracerEditsFile = path.join(tempDir, `tracer-edits-${sessionId}.json`);
  let tracerEdits = {};
  if (fs.existsSync(tracerEditsFile)) {
    try {
      tracerEdits = JSON.parse(fs.readFileSync(tracerEditsFile, "utf8"));
    } catch {}
  }

  if (path.basename(filePath) === "AGENT_TRACER.md") {
    tracerEdits[pkgRoot] = true;
    fs.writeFileSync(tracerEditsFile, JSON.stringify(tracerEdits));
  } else {
    sourceEdits[pkgRoot] = true;
    fs.writeFileSync(sourceEditsFile, JSON.stringify(sourceEdits));
  }

  process.exit(0);
})();
