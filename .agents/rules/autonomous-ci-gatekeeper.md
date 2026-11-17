# Autonomous Local CI Gatekeeper

When GitHub Actions is unavailable or locked due to an account billing issue (`The job was not started because your account is locked due to a billing issue`), agents MUST NOT stall waiting for GitHub Actions workflows.

## Required Autonomous Workflow

1. Run local verification via `pnpm agent:verify` (which writes `.ci-local/agent-verify-evidence.json`) and `pnpm policy:security --ci`.
2. Publish native GitHub Commit Statuses for the pushed commit SHA (`Quality Gates (Lint, Type Check, Build & Test)` and `Security Audit`) using `pnpm ci:gatekeeper --from-evidence --sha <sha>`.
3. To verify an existing open PR in an isolated git worktree and publish its statuses, run `pnpm ci:gatekeeper --pr <number>` (or `pnpm ci:gatekeeper --all-open-prs`).
4. `.husky/pre-push` automatically invokes `autonomous-ci-gatekeeper.mjs --from-evidence` after a verified push so `main` branch protection receives passing status checks without GitHub Actions minutes.
