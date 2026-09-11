---
title: Ultragoal Memory-Throttled Compilation & Dual-Mind Verification Hardening
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

# Ultragoal Memory-Throttled Compilation & Dual-Mind Verification Hardening

## Summary
Implement a system-wide memory-throttled compilation policy (`[build] jobs = 1`) to eliminate OOM crashes in the Rust orchestrator, and harden the `/ultragoal` framework by codifying Dual-Mind (Maker/Verifier) state tracking in a Supabase audit ledger and integrating it tightly with Antigravity and Turborepo.

## Problem
Concurrent Cargo builds of heavy dependency graphs (like `zerocopy`) exhaust the machine's 32GB RAM limit, causing `rustc` SIGKILLs. Furthermore, the `swarms-rs` orchestrator and `/ultragoal` framework require durable, cryptographically valid audit logs to guarantee that Maker agents never verify their own work, ensuring strict Dual-Mind integrity.

## Requirements
- Create/update `.cargo/config.toml` at repo root and `tools/swarms-orchestrator/.cargo/config.toml` to throttle build jobs.
- Migrate a new database table `public.ultragoal_runs` via Supabase to track Goal states.
- Establish Zod verification schemas in `packages/contract`.
- Define Antigravity workflows in `.antigravity/workflows/ultragoal-loop.json`.
- Integrate verification checks into `tools/swarms-orchestrator/package.json` and `turbo.json`.

## Key Technical Decisions
- **Single-Threaded Build:** `[build] jobs = 1` sacrifices build time for absolute memory stability during Rust compilation.
- **Supabase Ledger:** Verification runs will be logged to `public.ultragoal_runs` with RLS restricted to `service_role` for modifications to prevent agent spoofing.
- **Strict Dual-Mind Boundaries:** The Maker (`gemini-2.5-flash`) generates code, the Verifier (`gemini-2.5-pro`) evaluates evidence deterministically at `temperature: 0.0`.

## Implementation Units

### Unit 1: Cargo Memory Throttling
- **Scope:** Root and `tools/swarms-orchestrator` Cargo configuration.
- **Details:** Add `[build] jobs = 1` to `.cargo/config.toml`. Add `[target.x86_64-unknown-linux-gnu] rustflags = ["-C", "opt-level=1"]`.
- **Files:** `.cargo/config.toml`, `tools/swarms-orchestrator/.cargo/config.toml`.
- **Verification:** Run `cargo check` and verify `rustc` thread count remains at 1 and memory stays below bounds.

### Unit 2: Supabase Audit Ledger
- **Scope:** Database migrations and Row Level Security.
- **Details:** Create migration `packages/database/migrations/20260912_ultragoal_verification_ledger.sql` for `public.ultragoal_runs`. Add RLS policies restricting INSERT/UPDATE to `service_role`.
- **Files:** `packages/database/migrations/20260912_ultragoal_verification_ledger.sql`.
- **Verification:** Apply migration locally and test RLS insert denial for anon users.

### Unit 3: Zod Contracts
- **Scope:** Shared schemas in `packages/contract`.
- **Details:** Add `UltragoalStateSchema`, `VerifierEvidenceSchema`, and `CompilerResourceLimitsSchema`.
- **Files:** `packages/contract/src/ultragoal.ts`, `packages/contract/src/index.ts`.
- **Verification:** Compile `@repo/contract` successfully.

### Unit 4: Antigravity Workflow Runner
- **Scope:** Workflow configuration.
- **Details:** Create `.antigravity/workflows/ultragoal-loop.json` and `scripts/ultragoal-transition.sh` for bash-level state transitions.
- **Files:** `.antigravity/workflows/ultragoal-loop.json`, `scripts/ultragoal-transition.sh`.
- **Verification:** Shellcheck the transition script.

### Unit 5: Turborepo Pipeline Integration
- **Scope:** Workspace NPM scripts.
- **Details:** Add `check-types` (cargo check) and `build` (cargo build --release) to `tools/swarms-orchestrator/package.json`. Ensure `turbo.json` routes them.
- **Files:** `tools/swarms-orchestrator/package.json`, `turbo.json`.
- **Verification:** Run `pnpm turbo run check-types --filter=@repo/swarms-orchestrator`.
