# EARS Specification: Compaction Strategy Analysis & `/compact` / `/compact/compact` Improvements

- **Spec ID**: `SPEC-COMPACT-2026-11-10`
- **Status**: `DONE (2026-11-10)`
- **Author**: Antigravity Autonomous Engineering
- **Target Packages & Scripts**:
  - `packages/agents/src/token-budget.ts` & `packages/agents/src/token-budget.test.ts`
  - `tools/scripts/compact-context.cjs`
  - `slim-tooling-mcp/src/token-saving-engine.ts` & `slim-tooling-mcp/src/index.ts`
  - `.agents/hooks.json` & `.agents/hooks/pre-invocation-inject.sh`
  - `.agents/rules/context-lifecycle-and-compaction.md` & `.agents/skills/context-engineering/SKILL.md`

---

## 1. Empirical Forensic Analysis of Current Compacting Strategies

Analysis of **1,212 model generations** (`9,009,530` uncached input tokens, `161,375,216` cached read tokens, `94.7%` cache hit ratio, `724,001` output tokens) in the live Antigravity SQLite store (`conversations/999d8f18-0f73-4df3-9fbc-c385c3a91ba6.db`) and **3,004 transcript steps** (`transcript_full.jsonl`) revealed 12 compaction (`SYSTEM / CHECKPOINT`) events:

| Compaction Type                                                             | Count |       Pre-Compact Context Fill       |     Post-Compact Context Fill     | Handoff / Retrospective Persisted? |
| :-------------------------------------------------------------------------- | :---: | :----------------------------------: | :-------------------------------: | :--------------------------------: |
| **Harness Auto-Compaction** (`gen 204, 383, 444, 535, 613, 752, 882, 1138`) |  `8`  | `96.4% – 100.2%` (`246.9k – 256.6k`) | `10.7% – 11.9%` (`27.3k – 30.6k`) |           `0 / 8` (`0%`)           |
| **Manual `/compact` Command** (`gen 1039, 1091, 1193` + `step 1749`)        |  `4`  | `75.5% – 98.7%` (`193.4k – 252.7k`)  | `10.9% – 11.2%` (`28.0k – 28.7k`) |           `0 / 4` (`0%`)           |

### Five Root Causes Identified

1. **Harness Bypass of Agent Rules (`0/12` Handoffs Persisted)**:
   - Both `/compact` and auto-compaction execute inside the harness (`USER_INPUT /compact` $\rightarrow$ `SYSTEM CHECKPOINT`), never granting the LLM agent a tool-execution turn beforehand. Prose-only mandates in `context-lifecycle-and-compaction.md` cannot fire unless backed by deterministic lifecycle hooks (`PreInvocation` / `Stop`) and a standalone CLI (`tools/scripts/compact-context.cjs`).
2. **Post-Compaction Re-Fetch Bloat (`+182,993` Tokens in 18 Generations)**:
   - Immediately after `gen 1193` (`/compact` to `27,997` tokens / `10.9%`), context surged to `210,990` tokens (`82.4%`) within 18 generations due to full-file reads and loss of exact file-path/line-range state ("Artifact Trail Amnesia").
3. **Double-Compaction (`/compact/compact`) Cache-Rebuild Penalty**:
   - `/compact` replaces the conversation prefix, dropping `cache_read_tokens` to `0` on the next generation (`21,979` uncached tokens billed at `1x–2x` instead of `0.1x`). Invoking `/compact` a second time when context fill is already `< 25%` invalidates the newly warmed prefix cache for near-zero token reduction.
4. **Late Soft Compaction Threshold (`85%` vs `70%`)**:
   - In `@repo/agents` (`packages/agents/src/token-budget.ts`), `COMPACTION_SOFT_THRESHOLD = 0.85` left only `~38k` tokens of headroom in a 256k window — a single multi-file `read_file` or `agent:verify` run pushed usage past `96.5%` into an unannounced auto-compaction.
5. **Blind Middle-Truncation in `slim-tooling-mcp`**:
   - `TokenSavingEngine.truncateWindow` kept `65%` head and `35%` tail lines without scanning omitted middle lines for error markers or rare identifier needles (UUIDs, file paths, symbol names), causing agents to re-run commands to recover dropped needles.

---

## 2. EARS Requirements

### REQ-1: Proactive Dual-Threshold & Double-Compaction Guard (`@repo/agents`)

- **WHEN** `assessContextCompaction` or `evaluateDoubleCompactionGuard` is called in `@repo/agents`, **THE SYSTEM SHALL** trigger proactive handoff preparation at `70%` (`PROACTIVE_HANDOFF_THRESHOLD = 0.70`), soft compaction at `80%`, and critical hard drop at `92%`.
- **IF** compaction or `/compact/compact` is requested when `usageRatio < 0.25` (`COMPACTION_IDEMPOTENT_FLOOR`) or within `minTurnsBetweenCompactions` turns of the previous compaction, **THEN THE SYSTEM SHALL** return `'consolidate_state_spine'` (skipping a redundant LLM summary pass to preserve the prompt cache while performing deep on-disk state/memory consolidation).

### REQ-2: Bounded `SKILL.state` Spine & IDF Needle Preservation (`@repo/agents` & `slim-tooling-mcp`)

- **WHEN** `applyCompactionStatePatch` updates task state across compactions, **THE SYSTEM SHALL** merge non-null keys, delete keys set to `null`, and enforce an O(1) size ceiling of `4,000` characters (`~1,000` tokens).
- **WHEN** `TokenSavingEngine.truncateWindow` or `pruneRareNeedlesFromLog` compacts text exceeding the token budget, **THE SYSTEM SHALL** preserve error/credential lines and rare identifier lines (`documentFrequency <= 2`) in a bounded `[Preserved Needles & Error Lines]` section between the head and tail windows.

### REQ-3: Two-Stage `/compact` & `/compact/compact` Engine (`tools/scripts/compact-context.cjs`)

- **WHEN** `pnpm compact` (`standard`) or a single `/compact` hook triggers, **THE SYSTEM SHALL** extract the 6-section Artifact Trail from `transcript.jsonl` and `git status`, write dual-format `.handoff/handoff.md` (telegraphese) + `.handoff/handoff.json` (schema v1) + `<artifactDir>/HANDOFF.md`, update `.remember/now.md`, upsert the session retrospective in `.agents/memory_base/retrospectives/`, and re-index `.agents/memory_base/index.json`.
- **WHEN** `pnpm compact:deep` (`deep`) or `/compact/compact` triggers, **THE SYSTEM SHALL** execute Stage 1 (Artifact Trail + Handoff + State Spine) **PLUS** Stage 2 (archive duplicate/stale retrospectives, prune oversized scratch logs, and compact the state spine without invalidating the LLM prompt cache).

---

## 3. Verification & Quality Gates

1. `pnpm --filter @repo/agents test` — 100% pass on new compaction & state spine unit tests.
2. `cd slim-tooling-mcp && pnpm run build && pnpm test` — 100% pass on IDF needle preservation & `transcript_compact`.
3. `pnpm compact` & `pnpm compact:deep` — deterministic generation of `.handoff/handoff.md`, `.handoff/handoff.json`, `.remember/now.md`, and `.agents/memory_base/index.json`.
4. `pnpm agent:verify` — all verification gates pass (`100% PASS`).
