---
name: quartermaster
description: Automated quarterly engineering self-review generation, PR contribution synthesis, and OKR alignment.
---

# QuarterMaster Performance Review Runbook

## Overview

QuarterMaster automates engineering self-reviews by mining local git commits, merged pull requests, and code review activity, aligning accomplishments against team and organizational OKRs.

---

## 1. Core Commands

| Command                            | Action                                                      | Example                            |
| :--------------------------------- | :---------------------------------------------------------- | :--------------------------------- |
| `quartermaster generate`           | Synthesize quarterly engineering review from git history    | `quartermaster generate --json`    |
| `quartermaster prs`                | List merged PRs and review contributions in current quarter | `quartermaster prs`                |
| `quartermaster align <goals-file>` | Align contributions against explicit OKRs/goals markdown    | `quartermaster align docs/okrs.md` |

---

## 2. Agent Workflow Integration

- **Retrospective Synthesis**: Agents execute `quartermaster generate` at the conclusion of major development waves to summarize all delivered value into tracer archives.
