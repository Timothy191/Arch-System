#!/usr/bin/env node
/**
 * suggest-skills-on-edit: PostToolUse hook
 *
 * When specific file types are edited, emits a reminder to run the relevant
 * Claude Code skill for documentation, security audit, or migration validation.
 *
 * Async: true — does not block the agent loop.
 */

const fs = require("fs");
const path = require("path");

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

const SKILL_TRIGGERS = [
  {
    pattern: /apps\/portal\/app\/api\/.+\/route\.ts$/,
    message:
      "[SkillSuggestion] API route changed — consider running: node .claude/skills/api-doc/scan.cjs --write",
  },
  {
    pattern: /apps\/portal\/.+\/actions\.ts$/,
    message:
      "[SkillSuggestion] Server Action changed — consider running: node .claude/skills/security-audit/scan.cjs --scope=actions",
  },
  {
    pattern: /packages\/database\/migrations\/.+\.sql$/,
    message:
      "[SkillSuggestion] Migration changed — consider running: node .claude/skills/security-audit/scan.cjs --scope=migrations",
  },
];

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

  for (const trigger of SKILL_TRIGGERS) {
    if (trigger.pattern.test(filePath)) {
      console.error(trigger.message);
      break;
    }
  }

  process.exit(0);
})();
