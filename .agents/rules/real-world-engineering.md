---
description: "Real-world engineering standards, Pre-Write Critique Council, and Two-Layer Code Standards"
paths: ["apps/**/*", "packages/**/*", "libs/**/*"]
---

# Real-World Engineering Standards & Two-Layer Verification

## 1. Critical Real-World Thinking Mandate

All code, architectural designs, and automated scripts must assume production deployment under severe industrial mining conditions:

- Noisy, vibration-heavy environments (mandating audio-haptic feedback on handheld scanners).
- Intermittent connectivity (requiring optimistic updates, local storage queues, and graceful reconnects).
- High operator turnover (demanding strict visual error cues and fail-safe defaults).

## 2. Pre-Write Real-World Critique Council

Before modifying any core application logic or schema:

1. **Aspect Debate**: The proposed change must be evaluated against Feasibility, Maintainability, Security, Performance, and Industrial Reliability.
2. **Quality Score Gate**: Proceed only when the Real-World Quality Score achieves $\ge 90/100$:
   $$\text{Real-World Score} = \frac{\text{Feasibility} + \text{Maintainability} + \text{Security} + \text{Performance} + \text{Reliability}}{5}$$

## 3. Two-Layer Code Standards

Every implementation must satisfy two distinct layers of verification:

### Layer 1: Structural & Syntactic Gate

- **TypeScript**: 100% strict mode, zero `any`, zero `@ts-ignore`. Full compliance with `.agents/rules/code-refactoring.md` (REFAC-08 & REFAC-09); dynamic data uses `unknown`, Zod schema parsing, or type predicates (`val is Type`) instead of unsafe `as Type` casts.
- **Architectural Boundaries**: Full compliance with `@repo/eslint-config` and `tools/repo/policy-compiler.cjs`.
- **Unit & Integration Tests**: 100% pass rate across all Jest test suites with coverage meeting monorepo thresholds.
- **Zero Magic Numbers**: Full compliance with `.agents/rules/code-refactoring.md` (REFAC-01); all numeric values backed by unit-annotated constants or schema constraints.
- **Parameter Object Pattern**: Full compliance with `.agents/rules/code-refactoring.md` (REFAC-06); functions accepting $\ge 3$ parameters or ambiguous primitive types use a single typed options object.
- **DRY & Duplicate Code Extraction**: Full compliance with `.agents/rules/code-refactoring.md` (REFAC-07); repeated logic extracted into canonical helper functions, custom hooks, or shared monorepo packages.
- **Runtime Data Validation**: Full compliance with `.agents/rules/code-refactoring.md` (REFAC-09); all external API responses, local storage data, and IPC payloads parsed via canonical Zod schemas from `@repo/contract`.
- **Domain State Modeling**: Full compliance with `.agents/rules/code-refactoring.md` (REFAC-10); invalid or required domain states modeled with discriminated unions or handled with typed errors instead of being swallowed by optional chaining (`?.`).
- **Focused Composable Types**: Full compliance with `.agents/rules/code-refactoring.md` (REFAC-11); monolithic interfaces (>25 fields) decomposed into focused building blocks, intersection types (`&`), or utility types (`Pick`, `Omit`).
- **Lexical Integrity**: Full compliance with CSpell dictionary.

### Layer 2: Real-World Usability & Fault Tolerance

- **Physical Device Interlocks**: Handheld terminal (C66) hardware integration (`navigator.vibrate`, Web Audio tone).
- **Printer Hardware Alignment**: Card print canvas matching exact CR80 standard at 300 DPI (YMCKO ribbon).
- **Database & RLS Performance**: All queries and RLS policies utilize `(SELECT auth.uid())` initplan caching to avoid sequential scans.
- **Fail-Safe Recovery**: Graceful degradation on network failure or hardware disconnect without data loss.
