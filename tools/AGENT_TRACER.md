# AGENT_TRACER — tools

## 2026-11-05T08:45:00+02:00 - Zero-Drift Watchdog CI/CD Integration

- **Purpose**: Deploy Zero-Drift Watchdog to existing CI/CD pipeline for automated anti-drift synchronization between local Git, GitHub remote, and Vercel deployment states.
- **Changes**:
  - `.github/workflows/zero-drift-watchdog.yml`: Added dedicated Zero-Drift Watchdog CI job that runs on push to main and pull requests, with dependency on Redis integration tests and automated drift resolution using `--fix` flag.
  - `.github/workflows/ci.yml`: Enhanced existing `quality` job to include Zero-Drift Watchdog preflight validation as part of standard CI gate sequence.
  - `tools/zero-drift-watchdog/`: Ensured standalone package structure with comprehensive E2E test coverage (32/32 tests) covering tri-state drift matrix, GitHub/Vercel environment discovery, and automated deployment triggers.
- **Verification**: Workflow tests pass, integration tests confirm successful drift detection and automated remediation.

## 2026-11-05T08:47:00+02:00 - Agent Accuracy Enforcement 6-Pillar Protocol Integration

- **Purpose**: Integrate Agent Accuracy Enforcement mandate (`.agents/skills/agent-accuracy-enforcement/SKILL.md`) into core agent orchestration and verification flow.
- **Changes**:
  - `@repo/agents/src/prompt-envelope.ts`: Added Agent Accuracy Enforcement Pillar 1 (Zero-Exception Final Verification Gate) and Pillar 8 (Real-World Evidence Over Assumption) to `AgentPillarConfig` and `MANDATORY_NEGATIVE_CONSTRAINTS`.
  - `@repo/agents/src/quality-gate.ts`: Added Pillar 6 (Continuous Invariant Auditing) with `auditContent()` validation of contracts vs database parity, route/auth changes, UI changes, and RLS policy additions.
  - `@repo/agents/src/harness-engine.ts`: Added Pillar 2 (Dynamic On-Demand Context Leasing) with `runHarnessDoctor()` requiring `hasPermissionHooks`, `hasSyncedAgentRules`, `hasMcpRegistration`, and `hasStructuredThinkingMandate` verification.
  - `.agents/skills/agent-accuracy-enforcement/SKILL.md`: Added all 6 pillars as mandatory protocol across the workspace.
  - `packages/agents/AGENT_TRACER.md`: Updated with detailed pillar integration documentation.
- **Verification**: `pnpm --filter @repo/agents type-check` (0 errors); `pnpm --filter @repo/agents test` (58/58 tests pass).

## 2026-10-27: Supavisor Transaction Pooler Preflight Verification

- **Purpose**: Recognize `DATABASE_POOLER_URL` (port 6543) in `tools/scripts/vercel-preflight.cjs` so Vercel production preflight audits verify Supavisor transaction pooling with zero warnings.
- **Changes**:
  - `tools/scripts/vercel-preflight.cjs`: Checked `process.env.DATABASE_POOLER_URL` ahead of `DATABASE_URL` when validating Supavisor port 6543 routing.
- **Verification**: `pnpm deploy:vercel:preflight:prod` ✅ (0 warnings); `pnpm agent:verify` ✅.

## 2026-10-23: Tailwind Purge & CSS Build Budget Guardrail

- **Purpose**: Enforce strict Tailwind `content` purge rules and tighten the CSS bundle budget so unused classes cannot regress into the build.
- **Changes**:
  - `tools/audits/audit-tailwind-usage.cjs`: Added `checkTailwindPurgeConfig()` verifying `packages/theme/src/tailwind/preset.ts` scans only `.tsx` UI directories, excludes `node_modules`/build/test/story artifacts, and enables `hoverOnlyWhenSupported: true`.
  - `tools/audits/check-css-performance.cjs`: Tightened `BUDGET_KB` from `130` KB to `115` KB.
- **Verification**: `pnpm audit:tailwind` ✅; `pnpm lint:css-perf` ✅; `pnpm agent:verify` ✅.
