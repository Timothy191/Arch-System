# Arch-System Codespaces

This configuration provides a repeatable development container for the existing
pnpm/Turborepo monorepo. It does not configure or change Vercel, production
Supabase, production Redis, database migrations, or deployment workflows.

## Provisioned toolchain

- Node.js 24 (the repository requires Node.js >=24).
- pnpm 9.15.9, installed by the post-create bootstrap.
- Rust 1.85.0 with rustfmt and clippy, matching
  `tools/swarms-orchestrator/rust-toolchain.toml`.
- GitHub CLI and the repository's recommended VS Code extensions.
- Dependencies installed with `pnpm install --frozen-lockfile`.

## First launch

1. Open the repository in GitHub Codespaces and select this dev container.
2. Wait for the post-create command to finish. It installs dependencies only;
   it does not start the portal, Redis, Supabase, or any deployment.
3. Provide development-only Supabase configuration before starting the portal.
   Use a dedicated non-production Supabase project and its least-privilege
   development credentials. Do not add production credentials to Codespaces
   secrets, repository files, issue comments, or agent prompts.
4. Start the existing headless development path from the repository root:

   ```bash
   pnpm dev:quick
   ```

5. Open the forwarded port 3000 when Codespaces prompts.

## Optional local Redis

The repository already defines Redis startup through
`pnpm redis:up` and `infra/docker/compose.redis.yml`. Redis is not started by
the container bootstrap. Use it only when the Codespaces environment exposes a
working Docker daemon and the task requires local Redis integration.

## Verification commands

Run the repository's existing checks as required by the task:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm policy:check
pnpm agent:verify
```

For the Rust orchestrator:

```bash
cd tools/swarms-orchestrator
cargo +1.85.0 fmt --all -- --check
cargo +1.85.0 check --locked
cargo +1.85.0 clippy --all-targets --all-features --locked -- -D warnings
cargo +1.85.0 test --locked
```

The full monorepo checks may require development environment variables and
additional services. Do not substitute production credentials to make a check
pass. Record unavailable prerequisites and failures in the pull request.

## Security and operating boundaries

- Work in a feature branch and submit changes through pull requests.
- Keep agent permissions scoped to repository contents and PR creation.
- Do not grant agents merge, deployment, environment administration, secret
  management, or production database permissions.
- Never use this container as a route to production credentials or live plant
  control systems.
- The existing main-branch protection and required checks remain authoritative.
