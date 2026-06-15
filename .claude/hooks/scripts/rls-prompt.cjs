#!/usr/bin/env node
/**
 * rls-prompt: PreToolUse hook
 *
 * Soft-warns (exit 0 with stderr) when a SQL migration in
 * packages/database/migrations/ creates or alters a table without enabling
 * row-level security. Per .claude/rules/auth.md: "RLS must be enabled on
 * every new Supabase table. No exceptions."
 *
 * This is a SOFT prompt because:
 *   - views, temp tables, and GRANT statements can trip naive matches
 *   - the file is often written in stages (CREATE TABLE then ALTER ... ENABLE RLS)
 *   - we want the contributor to confirm, not be blocked
 *
 * Pairs with database-developer and migration-coordinator agents.
 */

const fs = require('fs');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => {
      data += c;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function hasCreateTable(content) {
  return /\bCREATE\s+TABLE\b/i.test(content) || /\bALTER\s+TABLE\b/i.test(content);
}

function hasRls(content) {
  return /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(content);
}

(async () => {
  const raw = await readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const filePath = input?.tool_input?.file_path || input?.tool_input?.TargetFile || '';
  if (!/packages\/database\/migrations\/.*\.sql$/.test(filePath)) process.exit(0);

  const content = input?.tool_input?.content || input?.tool_input?.new_string || '';
  if (!content || !hasCreateTable(content)) process.exit(0);
  if (hasRls(content)) process.exit(0);

  let fullText = content;
  try {
    fullText = fs.readFileSync(filePath, 'utf8');
  } catch {
    // File may not exist yet (Write); use just the new content.
  }
  if (hasRls(fullText)) process.exit(0);

  console.error(
    `[rls-prompt] ${filePath} contains CREATE TABLE / ALTER TABLE but no "ENABLE ROW LEVEL SECURITY".\n` +
      'See .claude/rules/auth.md "Row-Level Security". If this is intentional (e.g. a seed table), add a comment explaining why.'
  );
  process.exit(0);
})();
