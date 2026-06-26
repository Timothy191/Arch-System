# [TOKEN-SAVING AGENT MANIFEST: PRODUCTION-GRADE ONLY]

Hyper-dense contract for **all CLI and IDE agents** (Cursor, Claude Code, Codex, subagents). Symbolic tags = single-token anchors; expand via `.cursor/rules/*.mdc` only on violation.

## 1. PRE/POST HOOKS (token + safety)

| Tag              | Directive                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[H-CONTEXT]`    | Bind output to `10-src/@WHY.md`, `10-src/@HOW.md`, `10-src/@PROGRESSIVE_DISCLOSURE.md`. Paths: `10-src/`, `apps/`, `libs/features/`, `packages/` — never bare `src/`. |
| `[H-ZERO-TRUST]` | Explicit native types; boundary validation schemas; deterministic error paths. Reject loose dict payloads, `any`, silent coercion. Detect / isolate / recover.        |
| `[H-OBSERVE]`    | Structured logging + diagnostic traps on new service paths. `except: pass` or silent failure = instant reject.                                                        |

## 2. HARD OOPS GUARDS (runtime breaks)

| Tag            | Directive                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `[OOP-STATE]`  | Anti-volatile state. Offline-first persistence, local transaction logs, idempotent mutations. No critical state in ephemeral memory only. |
| `[OOP-PERF]`   | No magic numbers, un-clamped loops, blocking sync on UI/main thread. Backoff, chunked streaming, iterator bounds.                         |
| `[OOP-CLEAN]`  | Zero side-effects outside module scope. No hardcoded secrets, env mutation, or absolute machine paths. Explicit inputs/outputs only.      |
| `[OOP-PATH]`   | No stale `src/` or unverified symlinks. Modular functional root = `10-src/`.                                                              |
| `[OOP-SENSOR]` | Human-input-first control room. No invented PLC/SCADA/telemetry APIs without documented adapters.                                         |

## 3. WORKFLOW LOOPS (3-pass, internal only)

Execute before marking complete; emit **Pass 3 only** unless user requests drafts.

1. **PASS_1 (Functionality):** Core user intent; local-first mechanics; correctness.
2. **PASS_2 (Cascade):** Verified absolute imports; cascade naming/signature changes across full change set; UI glass / offline-first alignment per `10-src/@HOW.md`.
3. **PASS_3 (Prune+Edge):** Remove dead imports/unused vars; guard clauses over deep nesting; resource limits; offline/DB failure handling; full OOPs compliance.

**Librarian (per turn):** One sub-domain → read `.agents/skills/{name}/SKILL.md` → `python 10-src/checkout-skill.py` → work → `python 10-src/return-skill.py` → durable notes in `AGENT_TRACER.md`.

## 4. OUTPUT PROTOCOL

- No conversational filler ("Sure, here is the code").
- Emit **ONLY** the final deployment-ready asset.
- QA/polish passes: read-only — no tools, no edits unless user requested implementation.

## 5. PATCHING & SYSTEMATIC UPDATES [ZERO-REWRITE]

| Tag                | Directive                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[PATCH-ONLY]`     | Never reprint unchanged code or entire documents. Output **only** targeted unified diffs or localized blocks for lines that change.                                                                |
| `[CASCADE-UPDATE]` | If a change impacts external files, exports, or schemas, emit separate labeled patch blocks per target path (e.g., `File: libs/features/foo/ui/src/index.ts`).                                     |
| `[REPORT-FORMAT]`  | Structural delivery when patching: **(1) SYSTEMATIC STATUS** — bulleted changelog; **(2) TARGETED PATCHES** — line-specific blocks; **(3) POST-EXECUTION REPORT** — architectural stability check. |

## 6. AUTONOMOUS TRACE-REFLECTIVE OPTIMIZATION [SELF-IMPROVING]

| Tag                            | Directive                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `[TRACE-ANALYZE]`              | After generating a patch, review the active turn trace for token waste, drift, and thinking errors. |
| `[DETERMINE-META-IMPROVEMENT]` | Identify **exactly one** systemic flaw or optimization gap from this cycle.                         |
| `[APPEND-UPGRADE]`             | End the response with one explicit directive to upgrade performance vectors next turn.              |

## Tag → full rule map

| Tag                              | Expand in                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `[H-CONTEXT]`                    | `.cursor/rules/context-anchor.mdc`, `structural-audit.mdc`                                            |
| `[H-ZERO-TRUST]`                 | `.cursor/rules/zero-trust-defensiveness.mdc`                                                          |
| `[H-OBSERVE]`                    | `AGENT_TRACER.md` tracing contract, observability paths                                               |
| `[OOP-*]`                        | `.cursor/rules/oops-guardrails.mdc`                                                                   |
| PASS_1–3                         | `.cursor/rules/three-pass-optimization.mdc`                                                           |
| Librarian                        | `.cursor/rules/librarian-skill-workflow.mdc`                                                          |
| Performance / cascade            | `.cursor/rules/deterministic-performance-sanity-check.mdc`, `unified-system-cascade-verification.mdc` |
| `[PATCH-*]` / `[REPORT-FORMAT]`  | `.cursor/rules/patch-only-delivery.mdc`                                                               |
| `[TRACE-*]` / `[APPEND-UPGRADE]` | `.cursor/rules/trace-reflective-optimization.mdc`                                                     |

## QA minimal wrapper (token-saving)

```text
Apply [TOKEN-SAVING AGENT MANIFEST] to optimize the draft below. Fix gaps, enforce tag compliance, cascade naming, resolve dependencies. Emit ONLY the final polished asset.

[ORIGINAL USER REQUEST]:
{user_intent}

[DRAFT VALUE TO AUDIT]:
{raw_output}
```

Canonical path: `10-src/TOKEN-SAVING-AGENT-MANIFEST.md`
