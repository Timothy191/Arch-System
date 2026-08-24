#!/usr/bin/env node
/**
 * knip-on-stop: Stop hook
 *
 * Runs pnpm knip --no-config-hints when more than 10 unique files were edited
 * during the session. Surfaces orphaned exports and dead dependencies
 * immediately rather than waiting for CI.
 *
 * Reads session state written by track-package-edits.cjs.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

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

      const allEditsFile = path.join(tempDir, `all-edits-${sessionId}.txt`);

      if (!fs.existsSync(allEditsFile)) {
        console.log(data);
        return;
      }

      const lines = fs
        .readFileSync(allEditsFile, "utf8")
        .split("\n")
        .filter((l) => l.trim());
      const uniqueFiles = new Set(lines);

      if (uniqueFiles.size > 10) {
        try {
          const out = execSync("pnpm knip --no-config-hints 2>&1", {
            cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
            timeout: 120000,
            stdio: "pipe",
          });
          const output = out.toString().trim();
          if (
            output.includes("unused") ||
            output.includes("unlisted") ||
            output.includes("exports")
          ) {
            const lines = output.split("\n").filter((l) => l.trim());
            console.error(`[knip] Found potential issues (${lines.length} lines):\n${lines.slice(0, 5).join("\n")}${lines.length > 5 ? `\n... (+${lines.length - 5} more lines)` : ""}`);
          }
        } catch (err) {
          const raw = ((err.stdout || "") + "\n" + (err.stderr || "")).trim();
          const lines = raw.split("\n").filter((l) => l.trim());
          console.error(`[knip] Issues detected:\n${lines.slice(0, 5).join("\n")}${lines.length > 5 ? `\n... (+${lines.length - 5} more)` : ""}`);
        }
      }

      // Clean up session file
      try {
        fs.unlinkSync(allEditsFile);
      } catch {}

      console.log(data);
    } catch (err) {
      console.error("[ProWorkflow] knip-on-stop error:", err.message);
      console.log(data || "{}");
    }
  });
}

main().catch((err) => {
  console.error("[ProWorkflow] Error:", err.message);
  process.exit(0);
});
