---
name: gitbutler
description: Modern virtual branch management and concurrent workstream orchestration allowing parallel development and selective hunk commits from a single working tree.
---

# GitButler & Virtual Branching Runbook

## Overview

GitButler introduces virtual branches, enabling developers and autonomous agents to work on multiple isolated features simultaneously without traditional branch checkouts, stashes, or merge conflict overhead.

---

## 1. Core Concepts & Operations

| Concept                             | Workflow                                                            | Impact                                                             |
| :---------------------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------- |
| **Virtual Branches**                | Assign discrete file changes/hunks to separate virtual streams      | Multiple features developed in parallel without switching branches |
| **Intelligent Conflict Resolution** | Automatic hunk isolation and 3-way delta tracking                   | Prevents workstream cross-contamination                            |
| **Selective Commit Stacking**       | Push individual virtual branches to remote GitHub PRs independently | Granular, clean PRs for review                                     |

---

## 2. Agent Workflow Integration

- **Multi-Agent Worktree Pairing**: Used in conjunction with `git worktree` isolation to manage simultaneous subagent refactors without lock collisions.
