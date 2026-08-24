#!/usr/bin/env node
/**
 * agent-tracer-enforce: Stop hook
 *
 * Checks whether any package/app had source file edits during the session
 * without a corresponding AGENT_TRACER.md update. Warns if the mandatory
 * tracing rule was violated.
 *
 * Reads session state written by track-package-edits.cjs.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function getTempDir() {
  return path.join(os.tmpdir(), "pro-workflow");
}

function getSessionId(input) {
  return input?.session_id || process.env.CLAUDE_SESSION_ID || String(process.ppid) || "default";
}

async function main() {
  let data = "";
  process.stdin.on("data", (chunk) => {
    data += chunk;
  });
  process.stdin.on("end", () => {
    try {
      const input = JSON.parse(data);
      const sessionId = getSessionId(input);
      const tempDir = getTempDir();

      const sourceEditsFile = path.join(tempDir, `source-edits-${sessionId}.json`);
      const tracerEditsFile = path.join(tempDir, `tracer-edits-${sessionId}.json`);

      if (!fs.existsSync(sourceEditsFile)) {
        console.log(data);
        return;
      }

      let sourceEdits = {};
      let tracerEdits = {};
      try {
        sourceEdits = JSON.parse(fs.readFileSync(sourceEditsFile, "utf8"));
      } catch {}
      try {
        tracerEdits = JSON.parse(fs.readFileSync(tracerEditsFile, "utf8"));
      } catch {}

      const missing = Object.keys(sourceEdits).filter((pkg) => !tracerEdits[pkg]);

      if (missing.length > 0) {
        console.error(
          `[AgentTracer] Warning: Missing AGENT_TRACER.md update for: ${missing.join(", ")}. Remember to update tracer and add // AGENT-TRACE: comments.`
        );
      }

      // Clean up session files
      try {
        fs.unlinkSync(sourceEditsFile);
      } catch {}
      try {
        fs.unlinkSync(tracerEditsFile);
      } catch {}

      console.log(data);
    } catch (err) {
      console.error("[ProWorkflow] agent-tracer-enforce error:", err.message);
      console.log(data || "{}");
    }
  });
}

main().catch((err) => {
  console.error("[ProWorkflow] Error:", err.message);
  process.exit(0);
});
