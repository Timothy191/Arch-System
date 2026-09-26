# AGENTS.md

## 0. Purpose & Placement

- **Placement:** root (depth 0), beside `Requirements.md` and `Plan.md`. Hot-path — always loaded.
- **Filename:** `AGENTS.md` (mirror to `.cursorrules` / `CLAUDE.md` if required).
- **Hard cap:** ≤150 lines, ≤16 rules. Exceeding it means the rules are wrong, not the file.
- **Scope:** this file governs _how_. `Requirements.md` = _what_. `Plan.md` = _when_.

---

## 1. Rule Format

```text
ID        P3
Rule      <one-sentence imperative>
Why       <the failure it prevents>
Enforce   <the gate that catches violations>
```

A rule without a gate is a wish. Delete it.

---

## 2. Primary Rules (P1–P10) — Non-Negotiable

**P1 — One Constitution File.** All agent behavior governed here; patterns, exclusions, constraints live nowhere else.
_Why:_ scattered rules drift and contradict. _Enforce:_ lint fails if missing, >150 lines, or duplicated.

**P2 — Fix the Rule, Not Just the Bug.** Every mistake yields a rule edit or a recorded "no rule needed" decision.
_Why:_ same error recurs otherwise. _Enforce:_ post-task review requires rule diff or waiver.

**P3 — Plan Before Code (Non-Trivial Only).** Trivial = ≤1 file, ≤30 LOC. Else: written plan first. Autonomously adopt /plan & /goal execution, applying adaptive thinking and utilizing LLM Council & Palabre for deployments.
_Why:_ unbounded exploration burns context, and humans shouldn't manually prompt for planning. _Enforce:_ no plan + non-trivial diff = reject.

**P4 — Multi-Gate Quality Verification.** Agent permanently engages the 4-Pillar Verification (Real-World ARWR, Functionality, Modernization, High Standard) via `bash tools/scripts/enforce-quality-gates.sh` before presenting.
_Why:_ offloads verification to humans and ensures peak standard. _Enforce:_ PR requires 4-gate trace + exit code 0; no output, no review.

**P5 — Empirical Real-World Validation (ARWR).** Every change, plan, and decision MUST be derived from and anchored to verified real-world terminal output. Plans and memory are never sufficient evidence.
_Why:_ "Looks correct" is hallucination. _Enforce:_ ARWR validation gates required; no terminal output cited = hard block.

**P6 — Scope Is Explicit.** Every task declares `allow:` and `deny:` paths before work starts. Deny-hit halts.
_Why:_ agents wander into CI, infra, secrets. _Enforce:_ path policy in CI; deny-hit blocks merge.

**P7 — Dependency Changes Require Approval.** No new runtime dep without written justification and human sign-off.
_Why:_ supply chain and bloat. _Enforce:_ lockfile diff without approval token fails build.

**P8 — Risk-Tiered Human Review.** Tiers: 0 Docs/tests (auto) | 1 Features (1 reviewer) | 2 Auth/infra/deps (2 reviewers + security).
_Why:_ blanket review kills velocity; none kills codebase. _Enforce:_ tier derived from changed paths; Tier 2 requires labeled approval.

**P9 — Context Reset at Task Boundaries.** Clear context between unrelated tasks; write handoff note first (state, decisions, threads, next).
_Why:_ polluted context degrades reasoning. _Enforce:_ handoff note required before `/clear`.

**P10 — Reproducibility.** Pin model, tools, and seeds per run; record in task artifact.
_Why:_ non-reproducible failures can't be debugged. _Enforce:_ run manifest required; missing = invalid run.

---

## 3. Secondary Rules (S1–S6) — Warm Path

**S1 — Cost & Token Budget.** Per-task ceiling; 80% = checkpoint, 100% = halt and escalate.
_Why:_ runaway loops are the #1 hidden cost. _Enforce:_ telemetry counter with hard stop.

**S2 — Observability by Default.** New components emit traces, metrics, structured logs on first commit.
_Why:_ retrofits never happen. _Enforce:_ OTel check in CI for new modules.

**S3 — Concurrency & Locking.** One writer per path; long-running work holds a TTL lease with fencing token.
_Why:_ parallel agents clobber each other. _Enforce:_ lease required before write; stale writes rejected.

**S4 — Secrets & Data Hygiene.** No secrets, tokens, or PII in prompts, context, logs, or commits. Reference by handle.
_Why:_ irreversible exposure. _Enforce:_ pre-commit scan + redaction filter on telemetry sinks.

**S5 — Continuous Learning & Creation Department.** The permanent 'creation-department' subagent oversees every task. When requirements are met or patterns emerge, it autonomously researches, installs, and engineers new MCP servers, skills, and agents.
_Why:_ Unversioned improvisation stunts swarm growth. _Enforce:_ The Creation Department is triggered continuously post-task to synthesize new permanent capabilities.

**S6 — Maintainability Budget.** No module >400 LOC or >depth 4 without a written exception. Refactor before extending.
_Why:_ code is cheap; support is not. _Enforce:_ CI size/complexity gate; exception needs linked justification.

**S7 — Swarm Orchestration.** Hierarchy and swarming methods natively defined in `ORCHESTRATION.md` and applied autonomously.
_Why:_ unmanaged subagents duplicate work. _Enforce:_ dag-orchestrator requirement for >2 subagents.

**S8 — Wayland & Headless Execution Safeguards.** All automated browser tests (Playwright/Chromium) must include `--ozone-platform=wayland --disable-gpu` to prevent EGL crashes on Arch/Hyprland. Background installation scripts must bypass interactive prompts (`--yes`, no sudo) to prevent silent hangs.
_Why:_ Headless processes blocking on UI prompts or crashing on unsupported display servers cause runaway loops. _Enforce:_ CI check for `--ozone-platform=wayland` in e2e configs.

---

## 4. Hard Stops (Denylist + Escalation)

**Always prohibited — no approval path:**

- No edits to secrets, credentials, or key material.
- No force-push, history rewrite, or branch deletion.
- No disabling, skipping, or weakening tests, linters, or gates.
- No production data access from agent context.
- No writes outside the declared `allow:` list (P6).
- No new runtime dependency without approval (P7).
- No edits to CI/CD pipelines without Tier 2 approval (P8).
- No silent retries on destructive operations.

**Halt and escalate when:**

- A denylist action is required or rule conflict is unresolvable.
- Cost reaches 100% (S1) or 2 consecutive validation failures occur.
- Plan touches `deny:` path (P6) or Tier 2 change lacks second reviewer.

---

## 5. Change Control & Precedence

- Rule edits = Tier 1; denylist edits = Tier 2. Rules unused for 90 days are deletion candidates.
- Precedence: Hard Stops (§4) > Primary (P1–P10) > Secondary (S1–S6) > lower ID > human (logged waiver).

---

## 6. Definition of Done

- [ ] Plan artifact exists (P3, if non-trivial)
- [ ] Scope declared and respected (P6)
- [ ] Fail-to-pass test added (P5)
- [ ] Lint / tests / build run by agent, raw output pasted (P4)
- [ ] Run manifest recorded (P10)
- [ ] Review tier satisfied (P8)
- [ ] Handoff note written (P9)
- [ ] Rule diff or waiver recorded (P2)

---

## 7. At-a-Glance Card

```text
# AGENTS.md (≤150 lines)
P1 One constitution | P2 Fix rule, not just bug | P3 Auto /plan, /goal & council | P4 Multi-Gate Verification
P5 ARWR Empirical Validation | P6 allow/deny scope | P7 Approval for deps | P8 Tiers: 0 auto / 1 / 2 security
P9 Clean context + handoff | P10 Pin model/seed + manifest
S1 Token budget | S2 OTel by default | S3 Lease locks | S4 No secrets/PII | S5 Continuous Learning | S6 ≤400 LOC | S7 Swarm Orchestration
Hard Stops: Secrets · force-push · disabled gates · prod data · deny-path · unapproved deps · silent retries
Precedence: Hard Stops > Primary > Secondary > lower ID > human (logged)
Done: Plan · Scope · Test · Validation · Manifest · Review · Handoff · Rule diff
```
