#!/usr/bin/env node
/**
 * Policy SSoT Compiler (CommonJS runtime)
 *
 * This compiler is the direct Single Source of Truth (SSoT) for architectural boundaries and rules,
 * generating:
 *   - tools/policy/dependency.rules.json
 *   - tools/policy/architecture.rules.json
 *   - tools/policy/security.checks.json
 *   - tools/policy/intent-map.json
 *   - tools/policy/eslint-boundaries.generated.cjs
 *
 * Run via: pnpm policy:gen
 * Check via: pnpm policy:check (fails if drift detected)
 */

const fs = require("node:fs");
const path = require("node:path");

const POLICY_VERSION = "1.0.0";

const DEPENDENCY_RULES = [
  // Forbidden: apps must not reach into the database internals
  {
    sourceTag: "scope:app",
    targetTag: "scope:package:db-internal",
    allowed: false,
    reason:
      "apps/* must not import packages/database directly; use packages/supabase client",
  },

  // Forbidden: UI components must remain pure (no data layer)
  {
    sourceTag: "scope:package:ui",
    targetTag: "scope:package:db",
    allowed: false,
    reason: "UI components must be pure; no data layer access",
  },
  {
    sourceTag: "scope:package:ui",
    targetTag: "scope:package:db-internal",
    allowed: false,
    reason: "UI must not reach database internals",
  },
  {
    sourceTag: "scope:package:ui",
    targetTag: "scope:package:supabase",
    allowed: false,
    reason: "UI is presentational; data fetching belongs in features/",
  },

  // Forbidden: theme is consumed by UI, not the other way around
  {
    sourceTag: "scope:package:theme",
    targetTag: "scope:package:ui",
    allowed: false,
    reason: "Theme must not depend on UI; theme is consumed by UI",
  },

  // Forbidden: tools/* are build-time scripts; cannot import apps/* at runtime
  {
    sourceTag: "scope:tool",
    targetTag: "scope:app",
    allowed: false,
    reason: "tools/* are build-time scripts; cannot import apps/* at runtime",
  },
  {
    sourceTag: "scope:tool",
    targetTag: "scope:package:supabase",
    allowed: false,
    reason: "tools/* must not import runtime server/client code",
  },

  // Allow: apps may import any other package except those forbidden above
  // (apps are not restricted to a single package — they compose many)

  // Allow: packages may import other packages except forbidden combinations
  {
    sourceTag: "scope:package",
    targetTag: "scope:app",
    allowed: false,
    reason: "packages/* must not depend on apps/* (inversion of dependency)",
  },
];

const REQUIRED_CHECKS = [
  {
    projectType: "app",
    targets: ["build", "lint", "typecheck", "test"],
    blocking: true,
  },
  {
    projectType: "package",
    targets: ["build", "lint", "typecheck"],
    blocking: true,
  },
  { projectType: "tool", targets: ["lint", "typecheck"], blocking: false },
];

const INTENT_CAPABILITIES = [
  {
    name: "authentication",
    allowedClients: ["scope:app", "scope:package:supabase"],
    dbAccess: true,
    auditRequired: true,
    description: "User authentication via Supabase Auth",
  },
  {
    name: "authorization",
    allowedClients: ["scope:app", "scope:package:supabase"],
    dbAccess: true,
    auditRequired: true,
    description: "Role and department-based access control via employees table",
  },
  {
    name: "database-access",
    allowedClients: ["scope:package:supabase", "scope:package:database"],
    dbAccess: true,
    auditRequired: false,
    description:
      "Direct database access (must go through supabase or database packages)",
  },
  {
    name: "ai-orchestration",
    allowedClients: ["scope:app:portal"],
    dbAccess: true,
    auditRequired: true,
    description: "LangGraph AI agent; only portal can orchestrate",
  },
  {
    name: "design-tokens",
    allowedClients: ["scope:app", "scope:package:ui", "scope:package:theme"],
    dbAccess: false,
    auditRequired: false,
    description: "OKLCH design tokens from @repo/theme",
  },
  {
    name: "ui-rendering",
    allowedClients: ["scope:app:portal", "scope:app:cms", "scope:app:overview"],
    dbAccess: false,
    auditRequired: false,
    description: "React components and shadcn primitives",
  },
];

const SECURITY_CHECKS = [
  {
    id: "no-eval",
    rule: "No eval() or Function() constructor",
    pattern: "\\beval\\s*\\(|\\bnew\\s+Function\\s*\\(",
    paths: ["apps/**/*.{ts,tsx,js,jsx}"],
    severity: "error",
    enforceAt: ["ci", "local"],
  },
  {
    id: "no-sql-concat",
    rule: "No string-concatenated SQL queries",
    pattern: "`\\s*(SELECT|INSERT|UPDATE|DELETE).*\\$\\{",
    paths: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    severity: "error",
    enforceAt: ["ci", "local"],
  },
  {
    id: "no-raw-rls-disable",
    rule: "No RLS disabled in migrations",
    pattern: "ALTER\\s+TABLE.*DISABLE\\s+ROW\\s+LEVEL\\s+SECURITY",
    paths: ["packages/database/migrations/**"],
    severity: "error",
    enforceAt: ["ci"],
  },
  {
    id: "no-hardcoded-secrets",
    rule: "No hardcoded API keys or tokens",
    pattern: "(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})",
    paths: ["apps/**/*.{ts,tsx,js,jsx}", "packages/**/*.{ts,tsx,js,jsx}"],
    severity: "error",
    enforceAt: ["ci", "local"],
  },
  {
    id: "no-console-log",
    rule: "No console.log statements in production code",
    pattern: "console\\.log\\s*\\(",
    paths: ["apps/portal/**/*.{ts,tsx}"],
    severity: "warning",
    enforceAt: ["local"],
  },
];

const CHECK_MODE = process.argv.includes("--check");
const OUTPUT_DIR = path.join(__dirname, "policy");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function stripVolatile(o) {
  const copy = JSON.parse(JSON.stringify(o));
  if (copy.generatedAt) delete copy.generatedAt;
  return copy;
}
function writeOrCheck(filePath, content) {
  if (CHECK_MODE) {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing: ${filePath}`);
      return false;
    }
    const existing = stripVolatile(
      JSON.parse(fs.readFileSync(filePath, "utf-8")),
    );
    const incoming = stripVolatile(JSON.parse(content));
    if (
      JSON.stringify(existing, null, 2) !== JSON.stringify(incoming, null, 2)
    ) {
      console.error(`❌ Drift detected: ${filePath}`);
      return false;
    }
    console.log(`✓ ${filePath}`);
    return true;
  } else {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✓ Generated ${filePath}`);
    return true;
  }
}

const JSON_FILES = [
  "dependency.rules.json",
  "architecture.rules.json",
  "security.checks.json",
  "intent-map.json",
];

const timestamp = new Date().toISOString();
let allOk = true;

function generateJson(data) {
  return JSON.stringify(
    { version: POLICY_VERSION, generatedAt: timestamp, ...data },
    null,
    2,
  );
}

const jsonOutputs = [
  ["dependency.rules.json", { rules: DEPENDENCY_RULES }],
  ["architecture.rules.json", { checks: REQUIRED_CHECKS }],
  ["security.checks.json", { checks: SECURITY_CHECKS }],
];

for (const [name, data] of jsonOutputs) {
  allOk &= writeOrCheck(path.join(OUTPUT_DIR, name), generateJson(data));
}

const intentMap = {};
for (const cap of INTENT_CAPABILITIES) {
  intentMap[cap.name] = {
    allowedClients: cap.allowedClients,
    dbAccess: cap.dbAccess,
    auditRequired: cap.auditRequired,
    description: cap.description,
  };
}
allOk &= writeOrCheck(
  path.join(OUTPUT_DIR, "intent-map.json"),
  generateJson({ capabilities: intentMap }),
);

const depConstraints = DEPENDENCY_RULES.map((r) => {
  const targetTag = r.targetTag;
  if (r.allowed) {
    return {
      sourceTag: r.sourceTag,
      onlyDependOnLibsWithTags: [targetTag],
    };
  }
  return {
    sourceTag: r.sourceTag,
    notDependOnLibsWithTags: [targetTag],
  };
});

const eslintContent = `// GENERATED FROM tools/policy-compiler.cjs — DO NOT EDIT
// Run 'pnpm policy:gen' to regenerate.

module.exports = {
  plugins: ['@nx'],
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allowCircularSelfDependency: false,
        banTransitiveDependencies: true,
        checkDynamicDependenciesExceptions: ['^@repo/.*$'],
        depConstraints: ${JSON.stringify(depConstraints, null, 2)},
      },
    ],
  },
};
`;

// Check mode: compare eslint file literally (no timestamp in CJS).
if (CHECK_MODE) {
  const eslintPath = path.join(OUTPUT_DIR, "eslint-boundaries.generated.cjs");
  if (!fs.existsSync(eslintPath)) {
    console.error(`❌ Missing: ${eslintPath}`);
    allOk = false;
  } else if (fs.readFileSync(eslintPath, "utf-8") !== eslintContent) {
    console.error(`❌ Drift detected: ${eslintPath}`);
    allOk = false;
  } else {
    console.log(`✓ ${eslintPath}`);
  }
} else {
  const eslintPath = path.join(OUTPUT_DIR, "eslint-boundaries.generated.cjs");
  fs.writeFileSync(eslintPath, eslintContent, "utf-8");
  console.log(`✓ Generated ${eslintPath}`);
}

if (CHECK_MODE && !allOk) {
  console.error(
    "\n🔴 DRIFT DETECTED. Run `pnpm policy:gen` locally and commit generated files.",
  );
  process.exit(1);
}

if (!CHECK_MODE) {
  console.log(`\n✅ All 5 policy files generated.`);
  console.log(
    "Next: git add tools/policy/ tools/policy-compiler.cjs package.json and commit.",
  );
}
