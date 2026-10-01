# Test Infrastructure Specification: Zero Drift Watchdog

## 1. Overview & Architectural Principles

The Zero Drift Watchdog test infrastructure is designed for **opaque-box, hermetic, and zero-dependency verification** of multi-environment git and deployment state synchronization.

### Core Architectural Invariants

1. **Zero External Dependencies**: The test harness, mock fixtures, and test runners rely strictly on Node.js built-in modules (`node:test`, `node:assert/strict`, `node:http`, `node:child_process`, `node:fs`, `node:path`, `node:os`). No `npm install` is required to run the test suite.
2. **Hermetic Isolation**: Tests run entirely offline without outbound network calls to `api.github.com` or `api.vercel.com`. All HTTP requests are served by local, ephemeral HTTP servers bound to dynamic random ports (`port: 0`).
3. **Local Git Sandboxing**: Git operations run inside isolated temporary directories created in `os.tmpdir()`. Repositories and bare upstream remotes are cleaned up after each test execution.
4. **Deterministic & Repeatable**: Test executions avoid flaky timing issues by offering controllable state transitions (e.g. simulated Vercel build durations and instant deployment promotion upon polling).
5. **Dual-Mode Verification**: The suite supports progressive testing during milestone development, validating mock fixture fidelity and contract invariants, while seamlessly executing against the final CLI binary (`bin/zero-drift-watchdog.mjs`) as milestones complete.

---

## 2. Directory Layout

```
/home/tim/teamwork_projects/zero_drift_watchdog/
├── TEST_INFRA.md                   # This infrastructure specification
├── TEST_READY.md                   # Test suite readiness summary & checklist
└── test/
    ├── run-all-tests.mjs           # Master test runner script
    ├── fixtures/
    │   ├── mock-github.mjs         # HTTP server stubbing GitHub REST API
    │   ├── mock-vercel.mjs         # HTTP server stubbing Vercel REST API & Deploy Hooks
    │   ├── mock-git.mjs            # Local temporary Git repository sandbox generator
    │   └── fixtures.test.mjs       # Unit & integration verification for mock infrastructure
    └── e2e/
        ├── tier1_feature.test.mjs      # Tier 1: Feature coverage (individual features in isolation)
        ├── tier2_boundary.test.mjs     # Tier 2: Boundary & corner cases (unborn, detached, auth, 404/422)
        ├── tier3_combinations.test.mjs # Tier 3: Pairwise combinations (tri-state drift matrix)
        └── tier4_realworld.test.mjs    # Tier 4: Real-world application scenarios (push, deploy, poll, parity)
```

---

## 3. Mock Infrastructure Components

### 3.1 Mock GitHub Server (`test/fixtures/mock-github.mjs`)

A lightweight HTTP server stubbing the GitHub REST API (v2022-11-28) according to the authoritative GitHub API specification mined from production.

#### Supported Endpoints

- `GET /repos/:owner/:repo/branches/:branch`: Returns branch metadata and commit SHA (`.commit.sha`).
- `GET /repos/:owner/:repo/commits/:ref`: Returns commit details for full 40-char SHA, branch, or tag. Returns `422 Unprocessable Entity` if commit does not exist (mirroring real GitHub API behavior).
- `GET /repos/:owner/:repo/compare/:base...:head`: Evaluates commit drift using triple-dot syntax (`identical`, `ahead`, `behind`, `diverged`) with integer `ahead_by` and `behind_by` counts.

#### Invariants & Header Checks

- **Mandatory `User-Agent`**: Requests without a `User-Agent` header are rejected with `HTTP 403 Forbidden` and HTML body, matching GitHub gateway edge firewall behavior.
- **API Versioning**: Accepts and echoes `X-GitHub-Api-Version: 2022-11-28`.
- **Authentication**: Supports `Authorization: Bearer <token>` and `Authorization: token <token>`. Invalid tokens return `HTTP 401 Bad credentials`.
- **Rate Limit Headers**: Injects `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, and `retry-after` on all responses. Simulates `HTTP 403 API rate limit exceeded` when quota reaches 0.

#### Programmatic Control API

```javascript
import { createMockGitHubServer } from './mock-github.mjs';

const gh = createMockGitHubServer({ port: 0 });
await gh.start();

gh.setBranch('my-org', 'my-repo', 'main', 'f34570eba581c26d02dd6a7e1b85d0f7a6070dc9');
gh.setCompareStatus('my-org', 'my-repo', 'baseSha', 'headSha', {
  status: 'ahead',
  ahead_by: 1,
  behind_by: 0,
});
gh.setRateLimit({ remaining: 0, reset: Math.floor(Date.now() / 1000) + 3600 });

console.log('GitHub API URL:', gh.url); // e.g. http://127.0.0.1:41235
await gh.close();
```

---

### 3.2 Mock Vercel Server (`test/fixtures/mock-vercel.mjs`)

A lightweight HTTP server stubbing the Vercel REST API (v6, v7, v9, v13) and Deploy Webhooks.

#### Supported Endpoints

- `GET /v6/deployments` & `GET /v7/deployments`: Lists deployments filtered by `projectId`, `target=production`, `state=READY|BUILDING|ERROR`, `teamId`.
- `GET /v9/projects/:idOrName`: Returns project details with `targets.production` active deployment and commit SHA.
- `GET /v13/deployments/:idOrUrl`: Returns detailed single deployment inspection.
- `POST /v13/deployments`: Simulates creating or triggering a new deployment.
- `POST /v1/integrations/deploy/:hookId`: Simulates Vercel Deploy Hook triggering.

#### Invariants & State Machines

- **Authentication**: Requires `Authorization: Bearer <token>`. Missing token returns `HTTP 403 {"error":{"code":"forbidden","missingToken":true}}`.
- **Team Scoping**: Supports `?teamId=` query parameter for organization-owned projects.
- **In-Flight Lifecycle Simulation**: Configurable auto-promotion from `BUILDING` / `QUEUED` to `READY` after a specified poll count or manual trigger.
- **Rate Limiting**: Supports simulating `HTTP 429 Too Many Requests` with `retry-after` header.

#### Programmatic Control API

```javascript
import { createMockVercelServer } from './mock-vercel.mjs';

const vc = createMockVercelServer({ port: 0 });
await vc.start();

vc.setProject('prj_123', 'arch-system', {
  prodCommitSha: 'f34570eba581c26d02dd6a7e1b85d0f7a6070dc9',
  prodState: 'READY',
  teamId: 'team_xyz',
});

vc.queueTransition({
  fromSha: 'old_sha',
  toSha: 'new_sha',
  transitionsAfterPolls: 1, // becomes READY on second poll
});

console.log('Vercel API URL:', vc.url);
await vc.close();
```

---

### 3.3 Mock Git Sandbox (`test/fixtures/mock-git.mjs`)

A hermetic Git repository generator utilizing native `git` CLI commands inside isolated temporary directories.

#### Capabilities

- **Repository Initialization**: Initializes a repository with `main` branch, user config (`user.name`, `user.email`), and initial commits.
- **Commit Management**: Commits arbitrary files with custom messages; retrieves exact 40-character SHAs.
- **Dirty State Generation**: Creates untracked (`??`), unstaged modified (`M`), and staged (`A`/`M`) files.
- **Detached HEAD & Unborn Branches**: Simulates detached HEAD via `git checkout --detach` and unborn branches (0 commits).
- **Bare Upstream Remote**: Creates a companion local bare Git repository (`origin.git`) acting as `origin`. Allows real `git push origin main` to execute and succeed 100% locally and offline without network credentials.
- **Safe Teardown**: Recursively cleans up temporary directories and file locks.

#### Programmatic Control API

```javascript
import { createMockGitRepo } from './mock-git.mjs';

const repo = await createMockGitRepo({ branch: 'main' });
const commitA = repo.commitFile('README.md', '# Hello', 'Initial commit');
repo.setupBareOrigin(); // Creates local bare remote and configures tracking

// Create second commit to simulate local ahead
const commitB = repo.commitFile('app.js', 'console.log("drift")', 'feat: add drift');

console.log('Local HEAD:', repo.getHeadCommit());
console.log('Is Clean:', repo.isClean()); // true
repo.createDirtyFile('temp.txt', 'dirty content');
console.log('Is Clean after edit:', repo.isClean()); // false

repo.cleanup(); // Cleans up directory
```

---

## 4. 4-Tier Test Suite Specification

### Tier 1: Feature Coverage (`test/e2e/tier1_feature.test.mjs`)

Verifies each feature independently in isolation:

- `T1.1`: Local Git Commit Resolution — retrieves exact 40-char SHA of HEAD.
- `T1.2`: Local Working Tree Hygiene — detects clean state vs modified/untracked files.
- `T1.3`: Local Branch Resolution — resolves branch name and identifies detached HEAD.
- `T1.4`: GitHub Environment Discovery — discovers `owner/repo` from `GITHUB_REPOSITORY` or `git remote get-url origin`.
- `T1.5`: GitHub Branch Commit Lookup — queries `/repos/:owner/:repo/branches/:branch` for HEAD SHA.
- `T1.6`: GitHub Commit Compare — parses directional drift (`identical`, `ahead`, `behind`, `diverged`).
- `T1.7`: GitHub HTTP Invariants — validates mandatory `User-Agent`, API version, and Bearer auth headers.
- `T1.8`: Vercel Environment Discovery — discovers project ID and team ID from environment variables.
- `T1.9`: Vercel Active Deployment Lookup — retrieves latest production deployment in `READY` state.
- `T1.10`: Vercel Commit SHA Extraction — extracts commit SHA from `meta.githubCommitSha` with fallback precedence.
- `T1.11`: Vercel Team Scoping — passes `teamId` query parameter when team is configured.
- `T1.12`: Vercel In-Flight State Detection — detects `BUILDING` and `INITIALIZING` deployments.
- `T1.13`: CLI Usage & Help — verifies `--help` output contains all options and exits with code 0.

### Tier 2: Boundary & Corner Cases (`test/e2e/tier2_boundary.test.mjs`)

Verifies system resilience against invalid inputs, error states, and edge conditions:

- `T2.1`: Unborn Branch / Empty Repo — handles git repository with zero commits gracefully.
- `T2.2`: Detached HEAD — handles detached HEAD without crashing.
- `T2.3`: Missing GitHub Token — catches unauthenticated access or missing environment variables.
- `T2.4`: Missing Vercel Token — catches missing Vercel credentials with clear error messages.
- `T2.5`: Non-Existent GitHub Repository (404) — handles missing or inaccessible remote repositories.
- `T2.6`: Non-Existent Commit Ref (422) — handles unresolvable commit references without confusing with 404.
- `T2.7`: Non-Existent Vercel Project (404) — handles invalid Vercel project ID or slug.
- `T2.8`: Dirty Working Tree Blocking Push — prevents `git push` when uncommitted changes are present; reports drift error with exit code 1.
- `T2.9`: GitHub Rate Limit Exceeded (403) — detects `x-ratelimit-remaining: 0` and formats user guidance.
- `T2.10`: Vercel Rate Limiting (429) — parses `retry-after` header and avoids infinite rapid hammering.
- `T2.11`: Missing User-Agent Edge Rejection — verifies watchdog always supplies `User-Agent` and never triggers gateway 403s.
- `T2.12`: Network Connection Refused / Timeout — handles unreachable server gracefully with non-zero exit.

### Tier 3: Pairwise Combinations (`test/e2e/tier3_combinations.test.mjs`)

Verifies all permutations of the tri-environment drift matrix:

- `T3.1`: Perfect Tri-State Parity (`Local == GitHub == Vercel`) — reports zero drift, exits 0.
- `T3.2`: Local Ahead, GitHub matches Vercel (`Local > GitHub == Vercel`) — flags `localAhead: true`, exits 1 under `--audit-only`.
- `T3.3`: Local matches GitHub, Vercel Behind (`Local == GitHub > Vercel`) — flags `vercelBehind: true`, exits 1 under `--audit-only`.
- `T3.4`: Multi-Tier Drift (`Local > GitHub > Vercel`) — flags both `localAhead` and `vercelBehind`.
- `T3.5`: In-Flight Vercel Deployment (`Local == GitHub == Vercel (in flight)`) — identifies active build for matching commit, avoids triggering duplicate deployment.
- `T3.6`: Diverged Repositories (`Local != GitHub, ahead > 0 && behind > 0`) — flags `diverged: true`, forbids automated push, exits 1.
- `T3.7`: Local Behind Remote (`Local < GitHub`) — flags `localBehind: true`, prompts for git pull, does not push.

### Tier 4: Real-World Scenarios (`test/e2e/tier4_realworld.test.mjs`)

Validates complete operational end-to-end user workflows:

- `T4.1`: Clean Parity Check (`--audit-only`) — audit run on in-sync repository outputs "Zero drift", exits 0.
- `T4.2`: Automated Push Remediation (`--fix`) — local ahead repo triggers automatic `git push origin main`, updates bare origin, re-audits to parity.
- `T4.3`: Automated Deploy Hook Remediation (`--fix`) — Vercel behind triggers deploy webhook, polls until READY, re-audits to parity.
- `T4.4`: In-Flight Wait & Auto-Resolution — polls in-flight deployment until completed, exits 0.
- `T4.5`: Deployment Polling Timeout — exits with code 1 when Vercel deployment exceeds `--poll-timeout`.
- `T4.6`: Structured JSON Output Fidelity (`--json`) — asserts complete schema conformance with `DriftReport` interface.

---

## 5. Execution Instructions

### Run Entire Test Suite

```bash
node test/run-all-tests.mjs
```

### Run Specific Test Tier

```bash
node --test test/e2e/tier1_feature.test.mjs
node --test test/e2e/tier2_boundary.test.mjs
node --test test/e2e/tier3_combinations.test.mjs
node --test test/e2e/tier4_realworld.test.mjs
```

### Run Mock Fixture Verification Tests

```bash
node --test test/fixtures/fixtures.test.mjs
```
