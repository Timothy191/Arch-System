/* cspell:words knip preflight spector */
import type { GateCategory, ScoringCategory } from '@repo/contract';

export type GateSelectionMode = 'changed' | 'pr' | 'full' | 'release';

export interface QualityGateDefinition {
  readonly checkId: string;
  readonly name: string;
  readonly category: GateCategory;
  readonly scoringCategory: ScoringCategory;
  readonly owner: string;
  readonly command: string;
  readonly mandatory: boolean;
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly pathPatterns: readonly RegExp[];
  readonly modes: readonly GateSelectionMode[];
}

export interface SelectGatesOptions {
  readonly changedFiles: readonly string[];
  readonly mode: GateSelectionMode;
}

const TS_OR_JS_CODE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const STYLE_FILES = /\.(?:css|scss)$/i;
const UI_CODE = /^(?:apps\/portal\/|packages\/ui\/|packages\/theme\/|libs\/features\/.*\/ui\/)/i;
const HOOK_CODE = /(?:hooks\/|use[A-Z][A-Za-z0-9]*\.tsx?$)/;
const DOC_FILES = /\.(?:md|mdx)$/i;
const MANIFEST_FILES =
  /(?:^|\/)(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig.*\.json)$/;
const DB_FILES = /^(?:packages\/database\/|packages\/supabase\/|packages\/contract\/)/i;
const CONTRACT_OR_API_FILES =
  /^(?:packages\/contract\/|packages\/database\/|apps\/portal\/app\/api\/)/i;
const SECURITY_FILES =
  /(?:auth|proxy\.ts|rls|permission|rate-limit|secret|security|migrations\/|package\.json|pnpm-lock\.yaml)/i;
const INFRA_FILES =
  /^(?:apps\/portal\/next\.config\.|apps\/portal\/vercel\.json|infra\/|\.github\/|tools\/scripts\/vercel-preflight)/i;
const WORKER_FILES = /(?:worker|swarm|orchestrator|tools\/scripts\/|inngest)/i;
const AGENT_GOVERNANCE_FILES = /^(?:\.agents\/|\.gemini\/|AGENTS\.md|GEMINI\.md|tools\/audits\/)/i;
const ALL_SOURCE_CODE = /^(?:apps\/|packages\/|libs\/|tools\/|scripts\/)/i;

const ALL_MODES: readonly GateSelectionMode[] = ['changed', 'pr', 'full', 'release'];
const PR_AND_UP: readonly GateSelectionMode[] = ['pr', 'full', 'release'];
const FULL_AND_RELEASE: readonly GateSelectionMode[] = ['full', 'release'];

export const ALL_GATE_CATEGORIES: readonly GateCategory[] = [
  'code_quality',
  'architecture',
  'testing',
  'security',
  'database',
  'performance',
  'ui_ux',
  'infrastructure',
  'reliability',
  'agent_governance',
];

export const QUALITY_GATE_REGISTRY: readonly QualityGateDefinition[] = [
  {
    checkId: 'type-check',
    name: 'Workspace TypeScript Check',
    category: 'code_quality',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm type-check',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [TS_OR_JS_CODE, MANIFEST_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'biome-lint',
    name: 'Biome Code & Format Lint',
    category: 'code_quality',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm lint',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [TS_OR_JS_CODE, MANIFEST_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'stylelint',
    name: 'CSS Stylelint Check',
    category: 'code_quality',
    scoringCategory: 'accessibility_ux',
    owner: 'frontend-ui',
    command: 'pnpm lint:styles',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [STYLE_FILES, UI_CODE],
    modes: ALL_MODES,
  },
  {
    checkId: 'spelling-lint',
    name: 'CSpell Spelling Check',
    category: 'code_quality',
    scoringCategory: 'documentation_governance',
    owner: 'developer-experience',
    command: 'pnpm lint:spelling',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [TS_OR_JS_CODE, DOC_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'markdown-lint',
    name: 'Markdown Lint Check',
    category: 'code_quality',
    scoringCategory: 'documentation_governance',
    owner: 'developer-experience',
    command: 'pnpm md:lint',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [DOC_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'deps-lint',
    name: 'Workspace Dependency Sync Lint',
    category: 'code_quality',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm deps:lint',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [MANIFEST_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'knip-dead-code',
    name: 'Knip Unused Exports & Dead Code',
    category: 'code_quality',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm knip',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [ALL_SOURCE_CODE, MANIFEST_FILES],
    modes: FULL_AND_RELEASE,
  },
  {
    checkId: 'circular-deps',
    name: 'Circular Dependency Check',
    category: 'architecture',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm cycles',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [TS_OR_JS_CODE],
    modes: ALL_MODES,
  },
  {
    checkId: 'policy-check',
    name: 'Layering & Boundary Policy Check',
    category: 'architecture',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm policy:check',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [ALL_SOURCE_CODE, MANIFEST_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'contract-drift',
    name: 'Contract vs Schema Drift Audit',
    category: 'architecture',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm audit:drift',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [CONTRACT_OR_API_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'compliance-audit',
    name: 'Static Invariant Compliance Audit',
    category: 'architecture',
    scoringCategory: 'architecture',
    owner: 'platform-core',
    command: 'pnpm audit:compliance',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [ALL_SOURCE_CODE],
    modes: PR_AND_UP,
  },
  {
    checkId: 'code-intelligence-audit',
    name: 'CodeGraph Intelligence Index Audit',
    category: 'architecture',
    scoringCategory: 'documentation_governance',
    owner: 'platform-core',
    command: 'pnpm audit:code-intelligence',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [ALL_SOURCE_CODE],
    modes: FULL_AND_RELEASE,
  },
  {
    checkId: 'unit-tests',
    name: 'Workspace Unit Test Suite',
    category: 'testing',
    scoringCategory: 'functional_testing',
    owner: 'platform-core',
    command: 'pnpm test',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [TS_OR_JS_CODE],
    modes: ALL_MODES,
  },
  {
    checkId: 'worker-tests',
    name: 'Background Worker Test Suite',
    category: 'testing',
    scoringCategory: 'functional_testing',
    owner: 'platform-core',
    command: 'pnpm test:workers',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [WORKER_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'e2e-journeys',
    name: 'E2E Journey Coverage Audit',
    category: 'testing',
    scoringCategory: 'functional_testing',
    owner: 'qa-release',
    command: 'node tools/audits/audit-e2e-journeys.cjs',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [UI_CODE, /^e2e\//i],
    modes: ALL_MODES,
  },
  {
    checkId: 'live-e2e-suite',
    name: 'Live Browser Playwright E2E Suite',
    category: 'testing',
    scoringCategory: 'functional_testing',
    owner: 'qa-release',
    command: 'pnpm test:e2e',
    mandatory: false,
    available: false,
    unavailableReason: 'Requires RUN_LIVE_E2E=1 and a running portal server',
    pathPatterns: [UI_CODE, /^e2e\//i],
    modes: FULL_AND_RELEASE,
  },
  {
    checkId: 'supply-chain-audit',
    name: 'Supply Chain & Secret Hygiene Audit',
    category: 'security',
    scoringCategory: 'security',
    owner: 'security-team',
    command: 'pnpm audit:supply-chain',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [MANIFEST_FILES, SECURITY_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'auth-matrix-audit',
    name: 'RBAC & Auth Matrix Audit',
    category: 'security',
    scoringCategory: 'security',
    owner: 'security-team',
    command: 'pnpm audit:auth-matrix',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [SECURITY_FILES, /^apps\/portal\/app\//i],
    modes: ALL_MODES,
  },
  {
    checkId: 'database-check-migrations',
    name: 'Database Migration Integrity Check',
    category: 'database',
    scoringCategory: 'database_integrity',
    owner: 'database-team',
    command: 'pnpm --filter @repo/database check-migrations',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [DB_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'database-tests',
    name: 'Database RLS & Rollback Test Suite',
    category: 'database',
    scoringCategory: 'database_integrity',
    owner: 'database-team',
    command: 'pnpm --filter @repo/database test',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [DB_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'rls-matrix',
    name: 'PostgreSQL RLS Matrix Audit',
    category: 'database',
    scoringCategory: 'security',
    owner: 'database-team',
    command: 'pnpm audit:rls-matrix',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [DB_FILES, SECURITY_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'performance-budgets',
    name: 'Performance & Bundle Budgets Audit',
    category: 'performance',
    scoringCategory: 'performance',
    owner: 'platform-core',
    command: 'node tools/audits/audit-performance-budgets.cjs',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [UI_CODE, INFRA_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'css-performance',
    name: 'CSS Bundle Size Budget Check',
    category: 'performance',
    scoringCategory: 'performance',
    owner: 'frontend-ui',
    command: 'pnpm lint:css-perf',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [STYLE_FILES, UI_CODE],
    modes: ALL_MODES,
  },
  {
    checkId: 'audit-tailwind',
    name: 'Tailwind Utility Budget Audit',
    category: 'ui_ux',
    scoringCategory: 'accessibility_ux',
    owner: 'frontend-ui',
    command: 'pnpm audit:tailwind',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [UI_CODE],
    modes: ALL_MODES,
  },
  {
    checkId: 'audit-tokens',
    name: 'Light-Mode Design Token Audit',
    category: 'ui_ux',
    scoringCategory: 'accessibility_ux',
    owner: 'frontend-ui',
    command: 'pnpm audit:tokens',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [UI_CODE, STYLE_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'audit-images',
    name: 'Next Image Accessibility & Dimension Audit',
    category: 'ui_ux',
    scoringCategory: 'accessibility_ux',
    owner: 'frontend-ui',
    command: 'pnpm audit:images',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [UI_CODE],
    modes: ALL_MODES,
  },
  {
    checkId: 'audit-hooks',
    name: 'SSR-Safe React Hooks Audit',
    category: 'ui_ux',
    scoringCategory: 'accessibility_ux',
    owner: 'frontend-ui',
    command: 'pnpm audit:hooks',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [UI_CODE, HOOK_CODE],
    modes: ALL_MODES,
  },
  {
    checkId: 'vercel-preflight',
    name: 'Vercel Deployment Preflight Check',
    category: 'infrastructure',
    scoringCategory: 'reliability',
    owner: 'devops-release',
    command: 'node tools/scripts/vercel-preflight.cjs',
    mandatory: true,
    available: true,
    unavailableReason: null,
    pathPatterns: [INFRA_FILES, MANIFEST_FILES],
    modes: PR_AND_UP,
  },
  {
    checkId: 'observability-resilience',
    name: 'Observability & Resilience Audit',
    category: 'reliability',
    scoringCategory: 'reliability',
    owner: 'platform-core',
    command: 'node tools/audits/audit-observability-resilience.cjs',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [/^apps\/portal\//i, /^packages\/logger\//i, /^packages\/redis\//i],
    modes: FULL_AND_RELEASE,
  },
  {
    checkId: 'skill-spector',
    name: 'Agent Skill & Governance Integrity Check',
    category: 'agent_governance',
    scoringCategory: 'documentation_governance',
    owner: 'agent-governance',
    command: 'bash tools/audits/skill-spector.sh',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [AGENT_GOVERNANCE_FILES],
    modes: ALL_MODES,
  },
  {
    checkId: 'verify-27-gates',
    name: '28-Gate Agent Verification Runner',
    category: 'agent_governance',
    scoringCategory: 'documentation_governance',
    owner: 'agent-governance',
    command: 'node tools/audits/verify-gates.cjs',
    mandatory: false,
    available: true,
    unavailableReason: null,
    pathPatterns: [AGENT_GOVERNANCE_FILES],
    modes: FULL_AND_RELEASE,
  },
];

function matchesChangedFiles(
  gate: QualityGateDefinition,
  changedFiles: readonly string[]
): boolean {
  return changedFiles.some((filePath) =>
    gate.pathPatterns.some((pattern) => pattern.test(filePath))
  );
}

/**
 * Deterministically selects quality gates applicable to the requested execution
 * mode and set of changed file paths.
 */
export function selectGatesForChangedFiles(
  options: SelectGatesOptions
): readonly QualityGateDefinition[] {
  const { changedFiles, mode } = options;

  if (mode === 'full' || mode === 'release') {
    return QUALITY_GATE_REGISTRY.filter((gate) => gate.modes.includes(mode));
  }

  if (mode === 'pr') {
    return QUALITY_GATE_REGISTRY.filter(
      (gate) =>
        gate.mandatory || (gate.modes.includes('pr') && matchesChangedFiles(gate, changedFiles))
    );
  }

  if (changedFiles.length === 0) {
    return [];
  }

  return QUALITY_GATE_REGISTRY.filter((gate) => matchesChangedFiles(gate, changedFiles));
}
