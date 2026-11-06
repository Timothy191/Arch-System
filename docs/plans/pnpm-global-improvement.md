# Plan: Improve pnpm workspace & verification globally

## Goal

Standardize and optimize pnpm usage across Arch-System so all packages/agents produce improved, real-world-verified results.

## Research summary

- pnpm-workspace.yaml covers apps, packages, libs, scripts, seeds.
- Root package.json has many scripts; verification is fragmented (agent:verify vs quality vs targeted).
- Real-world verification script added for DepartmentCard; should be generalized.

## Implemented improvements

1. Added unified `verify:real-world` script (`scripts/verify-real-world.sh`) covering `pnpm type-check`, `pnpm lint`, `@repo/hub/ui` unit tests, and critical Playwright E2E flows (`e2e/authenticated-flows.spec.ts`, `e2e/department-navigation.spec.ts`, `e2e/data-entry.spec.ts`).
2. Normalized root verification and audit entrypoints (`verify:real-world`, `audit:all`).
3. Preserved canonical workspace resolution settings in `.npmrc` (`link-workspace-packages = true`, `resolution-mode = highest`, `shamefully-hoist = false`, `enable-pre-post-scripts=true`).
4. Consolidated compliance, contract drift, dependency syncpack (`deps:lint`), circular dependency (`cycles`), and dead-code (`knip`) checks under `pnpm audit:all`.

## Risks

- Changing global pnpm config may affect other projects; keep repo-local `.npmrc`.
- Merging scripts could break CI references.

## Next steps

- Review with team; implement incrementally.
