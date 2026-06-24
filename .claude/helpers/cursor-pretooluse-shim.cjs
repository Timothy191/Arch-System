#!/usr/bin/env node
/**
 * Ruflo PreToolUse shim for Cursor — runs telemetry silently, emits valid JSON.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function readStdinSync() {
  try {
    const chunk = Buffer.alloc(64 * 1024);
    let buf = "";
    let bytesRead;
    while (true) {
      try {
        bytesRead = fs.readSync(0, chunk, 0, chunk.length, null);
        if (bytesRead === 0) break;
        buf += chunk.slice(0, bytesRead).toString("utf8");
      } catch {
        break;
      }
    }
    return buf;
  } catch {
    return "";
  }
}

function main() {
  const stdinData = readStdinSync();
  let hookInput = {};
  if (stdinData.trim()) {
    try {
      hookInput = JSON.parse(stdinData);
    } catch {
      hookInput = {};
    }
  }

  const toolInput = hookInput.tool_input || hookInput.toolInput || {};
  const subcommand = process.argv[2] || "modify-bash";
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.env.CURSOR_PLUGIN_ROOT || "";
  const shimPath = pluginRoot ? path.join(pluginRoot, "scripts", "ruflo-hook.sh") : "";

  if (shimPath && fs.existsSync(shimPath)) {
    spawnSync("bash", [shimPath, subcommand], {
      input: stdinData,
      stdio: ["pipe", "ignore", "ignore"],
      timeout: 30_000,
    });
  }

  process.stdout.write(
    JSON.stringify({
      decision: "allow",
      tool_input: toolInput,
    }),
  );
}

main();
