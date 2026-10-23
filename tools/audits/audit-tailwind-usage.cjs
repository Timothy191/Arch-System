#!/usr/bin/env node

/**
 * Tailwind utility composition guardrail.
 *
 * Enforces two budgets across JSX/TSX UI code:
 *   1. A single className chain must not exceed `maxUtilitiesPerElement`
 *      utilities. Past that point the element is a component, not a leaf.
 *   2. An identical chain of `duplicateMinTokens`+ utilities repeated
 *      `duplicateMinUses`+ times must be combined (UI component, CVA variant,
 *      shared cn() constant, or theme class).
 *
 * Existing violations are grandfathered in `tailwind-baseline.json`. The gate
 * fails when a file exceeds its baseline or a repeated chain gains uses.
 * Regenerate the baseline only after a refactor lowers the counts.
 *
 * Usage:
 *   node tools/audits/audit-tailwind-usage.cjs
 *   node tools/audits/audit-tailwind-usage.cjs --update-baseline
 *
 * Exit codes: 0 = within baseline, 1 = new violations or missing baseline.
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'tailwind-baseline.json');

const CONFIG = Object.freeze({
  maxUtilitiesPerElement: 16,
  duplicateMinTokens: 10,
  duplicateMinUses: 3,
});

const SOURCE_GLOBS = ['apps/portal/**/*.tsx', 'packages/ui/src/**/*.tsx', 'libs/**/ui/**/*.tsx'];

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/*.test.tsx',
  '**/*.spec.tsx',
];

const APPLY_GLOBS = ['apps/**/*.{css,scss}', 'libs/**/*.{css,scss}'];
const APPLY_PATTERN = /@apply\b|@layer\s+components/;

const CLASS_CALLS = new Set(['cn', 'clsx', 'twMerge', 'classNames', 'cx']);
const MAX_EXPRESSION_DEPTH = 8;
const MAX_PRINTED_VIOLATIONS = 25;

const globSync = glob.globSync || glob.sync;

function tokenize(value) {
  return value.split(/\s+/).filter((token) => token.length > 0);
}

function collectStrings(node, out, depth = 0) {
  if (!node || depth > MAX_EXPRESSION_DEPTH) return;

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.push(node.text);
    return;
  }

  if (ts.isTemplateExpression(node)) {
    out.push(node.head.text);
    for (const span of node.templateSpans) out.push(span.literal.text);
    return;
  }

  if (ts.isConditionalExpression(node)) {
    collectStrings(node.whenTrue, out, depth + 1);
    collectStrings(node.whenFalse, out, depth + 1);
    return;
  }

  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) {
      collectStrings(node.left, out, depth + 1);
      collectStrings(node.right, out, depth + 1);
    } else if (
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.QuestionQuestionToken
    ) {
      // `cond && 'classes'`: only the right side carries class names; the
      // left side is a condition and its string literals are not classes.
      collectStrings(node.right, out, depth + 1);
    }
    return;
  }

  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    collectStrings(node.expression, out, depth + 1);
    return;
  }

  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) collectStrings(element, out, depth + 1);
    return;
  }

  if (ts.isCallExpression(node) && CLASS_CALLS.has(node.expression.getText())) {
    for (const argument of node.arguments) collectStrings(argument, out, depth + 1);
  }
}

function classStringsFromAttribute(attribute) {
  const strings = [];
  const initializer = attribute.initializer;
  if (!initializer) return strings;

  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
    strings.push(initializer.text);
  } else if (ts.isJsxExpression(initializer) && initializer.expression) {
    collectStrings(initializer.expression, strings);
  }
  return strings;
}

function scanSources() {
  const files = globSync(SOURCE_GLOBS, {
    cwd: ROOT,
    absolute: true,
    nodir: true,
    ignore: IGNORE_GLOBS,
  });

  const overBudgetByFile = new Map();
  const repeatedChains = new Map();
  const examples = new Map();
  let classAttributes = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const relativePath = path.relative(ROOT, file);
    let fileViolations = 0;

    const visit = (node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'className') {
        const strings = classStringsFromAttribute(node);
        let longest = [];
        for (const value of strings) {
          const tokens = tokenize(value);
          if (tokens.length > longest.length) longest = tokens;
          if (tokens.length >= CONFIG.duplicateMinTokens) {
            const fingerprint = [...new Set(tokens)].sort().join(' ');
            const entry = repeatedChains.get(fingerprint) ?? {
              tokens: tokens.length,
              uses: 0,
              sample: tokens.join(' '),
            };
            entry.uses += 1;
            repeatedChains.set(fingerprint, entry);
          }
        }

        if (longest.length > 0) classAttributes += 1;
        if (longest.length > CONFIG.maxUtilitiesPerElement) {
          fileViolations += 1;
          if (!examples.has(relativePath)) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            examples.set(relativePath, {
              line,
              length: longest.length,
              sample: longest.join(' ').slice(0, 120),
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    if (fileViolations > 0) overBudgetByFile.set(relativePath, fileViolations);
  }

  const cssViolations = [];
  const cssFiles = globSync(APPLY_GLOBS, {
    cwd: ROOT,
    absolute: true,
    nodir: true,
    ignore: IGNORE_GLOBS,
  });
  for (const file of cssFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (APPLY_PATTERN.test(content)) {
      cssViolations.push(path.relative(ROOT, file));
    }
  }

  return {
    filesScanned: files.length,
    classAttributes,
    overBudgetByFile,
    repeatedChains,
    examples,
    cssViolations,
  };
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ Cannot parse ${path.relative(ROOT, BASELINE_PATH)}: ${error.message}`);
    process.exit(1);
  }
}

function writeBaseline(scan) {
  const overBudgetByFile = {};
  for (const file of [...scan.overBudgetByFile.keys()].sort()) {
    overBudgetByFile[file] = scan.overBudgetByFile.get(file);
  }

  const repeatedChains = {};
  for (const fingerprint of [...scan.repeatedChains.keys()].sort()) {
    const entry = scan.repeatedChains.get(fingerprint);
    if (entry.uses >= CONFIG.duplicateMinUses) {
      repeatedChains[fingerprint] = { tokens: entry.tokens, uses: entry.uses };
    }
  }

  const baseline = {
    version: 1,
    generatedAt: new Date().toISOString(),
    config: { ...CONFIG },
    overBudgetByFile,
    repeatedChains,
  };

  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  const files = Object.keys(overBudgetByFile).length;
  const chains = Object.keys(repeatedChains).length;
  console.log(
    `✅ Baseline written to ${path.relative(ROOT, BASELINE_PATH)} (${files} files, ${chains} repeated chains).`
  );
}

function checkConfig(baseline) {
  const mismatched = Object.keys(CONFIG).filter((key) => baseline.config?.[key] !== CONFIG[key]);
  if (mismatched.length === 0) return true;
  console.error('❌ Baseline config is stale:');
  for (const key of mismatched) {
    console.error(`   ${key}: baseline=${baseline.config?.[key]} current=${CONFIG[key]}`);
  }
  console.error('   Refactor the code to the new limits, then run --update-baseline.');
  return false;
}

function check(scan, baseline) {
  const violations = [];

  for (const [file, count] of scan.overBudgetByFile) {
    const allowed = baseline.overBudgetByFile?.[file] ?? 0;
    if (count > allowed) {
      const example = scan.examples.get(file);
      violations.push(
        `over-budget className: ${file}:${example.line} (${example.length} utilities, baseline ${allowed})\n   ${example.sample}`
      );
    }
  }

  for (const [fingerprint, entry] of scan.repeatedChains) {
    if (entry.uses < CONFIG.duplicateMinUses) continue;
    const allowed = baseline.repeatedChains?.[fingerprint]?.uses ?? 0;
    if (entry.uses > allowed) {
      const label = allowed === 0 ? 'new repeated chain' : 'repeated chain gained uses';
      violations.push(
        `${label}: ${entry.uses}x (baseline ${allowed}, ${entry.tokens} utilities)\n   ${entry.sample.slice(0, 160)}\n   Extract it into a component, CVA variant, or shared cn() constant.`
      );
    }
  }

  for (const file of scan.cssViolations) {
    violations.push(
      `@apply/@layer components outside the design system: ${file}\n   Move the rule into packages/theme (or packages/ui globals) and use a component class.`
    );
  }

  const improvedFiles = Object.entries(baseline.overBudgetByFile ?? {}).filter(
    ([file, allowed]) => (scan.overBudgetByFile.get(file) ?? 0) < allowed
  ).length;
  const improvedChains = Object.entries(baseline.repeatedChains ?? {}).filter(
    ([fingerprint, entry]) => (scan.repeatedChains.get(fingerprint)?.uses ?? 0) < entry.uses
  ).length;

  if (violations.length > 0) {
    console.error('\n🔴 Tailwind utility composition violations:\n');
    for (const violation of violations.slice(0, MAX_PRINTED_VIOLATIONS)) {
      console.error(`❌ ${violation}\n`);
    }
    if (violations.length > MAX_PRINTED_VIOLATIONS) {
      console.error(`… and ${violations.length - MAX_PRINTED_VIOLATIONS} more.\n`);
    }
    console.error(
      'AGENT DIRECTIVE: combine utilities that serve one purpose (UI component, CVA variant, shared cn() constant, or theme class). Do not regenerate the baseline to hide new violations.'
    );
    return false;
  }

  console.log(
    `✅ Tailwind utility usage within baseline (${scan.filesScanned} files, ${scan.classAttributes} chains).`
  );
  if (improvedFiles > 0 || improvedChains > 0) {
    console.log(
      `   Ratchet available: ${improvedFiles} files and ${improvedChains} chains are below baseline — run --update-baseline to lock in the reduction.`
    );
  }
  return true;
}

function main() {
  console.log('\n🎨 Tailwind Utility Composition Audit\n');
  console.log(
    `   Budget: ${CONFIG.maxUtilitiesPerElement} utilities/element; duplicates: ${CONFIG.duplicateMinTokens}+ utilities x${CONFIG.duplicateMinUses}.\n`
  );

  const scan = scanSources();

  if (process.argv.includes('--update-baseline')) {
    writeBaseline(scan);
    return;
  }

  const baseline = readBaseline();
  if (!baseline) {
    console.error(
      `❌ Missing ${path.relative(ROOT, BASELINE_PATH)}. Run: node tools/audits/audit-tailwind-usage.cjs --update-baseline`
    );
    process.exit(1);
  }
  if (!checkConfig(baseline)) process.exit(1);
  if (!check(scan, baseline)) process.exit(1);
}

main();
