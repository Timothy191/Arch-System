#!/usr/bin/env node
/**
 * Cursor-compatible PreToolUse hook handler.
 * AGENT-TRACE: PreToolUse hooks must emit valid JSON on stdout for Cursor.
 */
const path = require("path");
const fs = require("fs");

const helpersDir = __dirname;

function safeRequire(modulePath) {
  try {
    if (fs.existsSync(modulePath)) {
      const origLog = console.log;
      const origError = console.error;
      console.log = () => {};
      console.error = () => {};
      try {
        return require(modulePath);
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    }
  } catch {
    // optional modules
  }
  return null;
}

const session = safeRequire(path.join(helpersDir, "session.cjs"));

const [, , command] = process.argv;

function logInfo(message) {
  process.stderr.write(`${message}\n`);
}

function allowPreToolUse(toolInput) {
  process.stdout.write(
    JSON.stringify({
      decision: "allow",
      tool_input: toolInput && typeof toolInput === "object" ? toolInput : {},
    }),
  );
}

function denyPreToolUse(reason, toolInput) {
  process.stdout.write(
    JSON.stringify({
      decision: "deny",
      reason,
      tool_input: toolInput && typeof toolInput === "object" ? toolInput : {},
    }),
  );
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  return new Promise((resolve) => {
    let data = "";
    const timer = setTimeout(() => {
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(data);
    }, 500);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.resume();
  });
}

async function main() {
  let stdinData = "";
  try {
    stdinData = await readStdin();
  } catch {
    // ignore stdin errors
  }

  let hookInput = {};
  if (stdinData.trim()) {
    try {
      hookInput = JSON.parse(stdinData);
    } catch {
      // ignore parse errors
    }
  }

  const toolInput = hookInput.toolInput || hookInput.tool_input || {};
  const prompt =
    hookInput.prompt || hookInput.command || toolInput.command || process.env.PROMPT || "";

  const handlers = {
    "pre-bash": () => {
      const cmd = String(hookInput.command || toolInput.command || prompt || "").toLowerCase();
      const dangerous = ["rm -rf /", "format c:", "del /s /q c:\\", ":(){:|:&};:"];
      for (const signature of dangerous) {
        if (cmd.includes(signature)) {
          logInfo(`[BLOCKED] Dangerous command detected: ${signature}`);
          denyPreToolUse(`Dangerous command detected: ${signature}`, toolInput);
          process.exit(1);
        }
      }
      allowPreToolUse(toolInput);
      logInfo("[OK] Command validated");
    },

    "pre-edit": () => {
      allowPreToolUse(toolInput);
      logInfo("[OK] Edit allowed");
    },

    "post-edit": () => {
      if (session && session.metric) {
        try {
          session.metric("edits");
        } catch {
          // no active session
        }
      }
      logInfo("[OK] Edit recorded");
    },

    route: () => logInfo("[OK] Route"),
    "session-restore": () => logInfo("[OK] Session restored"),
    "session-end": () => logInfo("[OK] Session ended"),
    "post-bash": () => logInfo("[OK] Command recorded"),
    "post-task": () => logInfo("[OK] Task completed"),
    status: () => logInfo("[OK] Status"),
  };

  if (command && handlers[command]) {
    try {
      await Promise.resolve(handlers[command]());
    } catch (error) {
      if (command === "pre-bash" || command === "pre-edit") {
        allowPreToolUse(toolInput);
      }
      logInfo(`[WARN] Hook ${command} encountered an error: ${error.message}`);
    }
  } else if (command) {
    logInfo(`[OK] Hook: ${command}`);
  }
}

main().finally(() => {
  process.exit(0);
});
