#!/usr/bin/env node

/**
 * @fileoverview AST-based Compound Bash Command Safety Checker
 * Validates command chains against safety rules and dangerous system operations.
 * Usage: node tools/scripts/check-compound-bash.cjs "<compound_command>" [--explain]
 */

const args = process.argv.slice(2);
const explain = args.includes('--explain');
const rawCmd = args
  .filter((a) => a !== '--explain')
  .join(' ')
  .trim();

if (!rawCmd) {
  console.log('Usage: node tools/scripts/check-compound-bash.cjs "<command>" [--explain]');
  process.exit(1);
}

// Split command on logical boundaries (&&, ||, ;, |)
const delimiters = /(&&|\|\||;|\|)/g;
const rawSegments = rawCmd.split(delimiters);

const segments = [];
for (let i = 0; i < rawSegments.length; i++) {
  const item = rawSegments[i].trim();
  if (item && !item.match(/^(&&|\|\||;|\|)$/)) {
    segments.push(item);
  }
}

// Forbidden patterns
const DANGEROUS_PATTERNS = [
  { pattern: /\brm\s+-[rfR]*\s+[/~]/, reason: 'Destructive filesystem root deletion' },
  { pattern: />\s*\/dev\/[s|h|n]d[a-z0-9]*/, reason: 'Direct block device write' },
  { pattern: /\b(mkfs|dd\s+if=)/, reason: 'Direct disk formatting or raw block write' },
  { pattern: /\bchmod\s+-R\s+777\s+\//, reason: 'Unsafe global permission elevation' },
  { pattern: /\bcurl.*\|\s*(bash|sh)/, reason: 'Unverified remote script execution pipe' },
];

let violations = 0;

if (explain) {
  console.log('🔍 [CompoundBashAuditor] AST Command Segmentation:');
  segments.forEach((seg, idx) => {
    console.log(`  Segment ${idx + 1}: \`${seg}\``);
  });
  console.log('');
}

segments.forEach((seg, idx) => {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(seg)) {
      console.error(`❌ [DENIED] Segment ${idx + 1} violated security policy: ${reason}`);
      console.error(`   Offending segment: "${seg}"`);
      violations++;
    }
  }
});

if (violations === 0) {
  console.log(
    `🟢 [CompoundBashAuditor] PASSED: Command verified safe (${segments.length} segment${segments.length === 1 ? '' : 's'}).`
  );
  process.exit(0);
} else {
  console.error(
    `\n🔴 [CompoundBashAuditor] REJECTED: ${violations} critical security violation(s) detected.`
  );
  process.exit(1);
}
