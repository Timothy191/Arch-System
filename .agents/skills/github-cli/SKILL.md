---
name: github-cli
description: Official GitHub CLI (gh) runbook for managing pull requests, issues, CI/CD GitHub Actions workflows, releases, and repository configurations directly from the terminal.
---

# GitHub CLI (`gh`) Operational Runbook

## Overview

GitHub CLI (`gh`) provides terminal-based interaction with GitHub repositories, eliminating browser context switching and enabling automated CI/CD and PR operations for autonomous agents.

---

## 1. Core Commands

| Command                  | Action                                                  | Example                                                          |
| :----------------------- | :------------------------------------------------------ | :--------------------------------------------------------------- |
| `gh pr create`           | Open a pull request with branch diffs and template body | `gh pr create --title "feat: access control suite" --body "..."` |
| `gh pr list / status`    | Inspect active pull requests and check statuses         | `gh pr status`                                                   |
| `gh pr merge <id>`       | Merge an approved PR with squash or merge commit        | `gh pr merge 42 --squash --auto`                                 |
| `gh issue list / create` | Manage issues, bug reports, and task tracking           | `gh issue list --label "bug"`                                    |
| `gh run list / watch`    | Monitor GitHub Actions CI/CD workflows live             | `gh run watch`                                                   |
| `gh release create`      | Publish a semantic version release with artifacts       | `gh release create v1.5.2 --generate-notes`                      |

---

## 2. Agent Workflow Integration

- **Autonomous PR Generation**: Swarm specialists invoke `gh pr create` upon completing verification gates.
- **CI/CD Build Monitoring**: Agents execute `gh run watch` to assert remote pipeline health without leaving the terminal.
