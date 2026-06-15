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
  return (
    input?.session_id ||
    process.env.CLAUDE_SESSION_ID ||
    String(process.ppid) ||
    "default"
  );
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
        console.error(
          `[ProWorkflow] ${uniqueFiles.size} files edited — running knip for dead-code check...`,
        );
        try {
          const out = execSync("pnpm knip --no-config-hints 2>&1", {
            cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
            timeout: 120000,
            stdio: "pipe",
          });
          const output = out.toString();
          if (
            output.includes("unused") ||
            output.includes("unlisted") ||
            output.includes("exports")
          ) {
            console.error("[ProWorkflow] knip found potential issues:");
            console.error(output.split("\n").slice(0, 30).join("\n"));
          } else {
            console.error("[ProWorkflow] knip clean — no dead code detected.");
          }
        } catch (err) {
          const stdout = (err.stdout || "").toString();
          const stderr = (err.stderr || "").toString();
          console.error(
            "[ProWorkflow] knip output:\n" + (stdout || stderr || err.message),
          );
        }
      } else {
        console.error(
          `[ProWorkflow] ${uniqueFiles.size} file(s) edited — knip threshold (10) not reached.`,
        );
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
