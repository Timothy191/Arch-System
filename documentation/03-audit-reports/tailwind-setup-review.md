# Tailwind CSS Setup Review — Notes & Citations for Next Agent

Date: 2026-11-02. Scope: `packages/theme/src/tailwind/preset.ts`, `apps/portal/tailwind.config.ts`, `packages/ui/tailwind.config.ts`, Biome `nursery/useSortedClasses`, `tools/audits/audit-tailwind-usage.cjs`.

## Current setup

- Single SSOT preset: `packages/theme/src/tailwind/preset.ts` (542 LOC) re-exported by both apps (`apps/portal/tailwind.config.ts`, `packages/ui/tailwind.config.ts`).
- Content globs cover `apps/*/app|components|features|plugins`, `packages/ui/src`, `packages/theme/src/react`, `libs/features/*/ui/src` (preset.ts:19-42). Excludes tests/stories and a few heavy files.
- `withAlpha` helper (preset.ts:49-53) wraps CSS vars so opacity modifiers work via `color-mix`.
- Biome enforces sorted utility classes (`nursery/useSortedClasses` error) and tailwind audit enforces ≤20 utilities/element + duplicate-chain extraction.

## Blockers / risks identified

1. **Dynamic class construction may be purged.** Components build classNames at runtime (`${badgeColor}`, `${badgeBg}`, `${availabilityClass}`, `${badgeClassName}` — found across apps). Tailwind cannot see these at build time; missing classes will be dropped. Mitigation: add a `safelist` array to the preset for the dynamic color/size tokens, OR refactor to lookup maps of full static class strings (preferred per code-quality rule #8). Citation: `preset.ts` content array (lines 19-42) has no `safelist`.
2. **Tier-1 primitives commented out** (`packages/theme/src/css/variables.css:20-46`). Semantic aliases (preset.ts colors `arch0..arch15`) resolve to undefined if `variables-generated.css` isn't imported first. Verify import order in `apps/portal/app/layout.tsx`. Blocker for any new token usage.
3. **Brand identity split** — `--accent-electric-blue: #d4af37` (gold) but subtle/border/glow were blue (partially fixed in commit ece9ef12). Remaining blue glow tokens (`--shadow-glow-blue/primary/electric`) still blue by design — document which is which.
4. **Non-token raw colors in components** (access-control dark card, AlertPanel hex, SplitWindowWhatsAppView, GlassCard hex table, PrecisionInput). These bypass the preset and won't respond to token changes. Tracked in prior exploration.
5. **Arbitrary font sizes** `text-[8px]..[13px]` not in the type scale (preset.ts `fontSize` only defines tremor + fluid scales). Either add a compact scale or migrate to `text-xs/sm`.
6. **Tailwind utility budget overruns** in 5 files (login, ControlRoomQuickNav, CoreOperationalModules, LoginForm, shadcn dialog/dropdown/select) — audit passes at baseline but new work should not add to it.
7. **30+ repeated chains** in `tools/audits/tailwind-baseline.json` not extracted — maintainability debt.

## Recommended improvements (robustness & finesse)

- Add `safelist` to preset for dynamically-constructed color utilities, OR (preferred) convert dynamic className to static lookup maps.
- Add a compact `fontSize` scale (`2xs`, `xs2`, etc.) to replace arbitrary `text-[9px]` etc., or document migration to existing `fluid-*`.
- Standardize token namespace: prefer `var(--…)` / `arch-*` over raw Tailwind ramps and `accent-*` (non-canonical).
- Keep `withAlpha` for all new color tokens to preserve opacity modifiers.
- Add an automated check in `audit-tailwind-usage.cjs` for dynamic className patterns (template literals with `${}`) and fail on unknown tokens.
- Keep content globs in sync when adding new UI directories (e.g., new `libs/*/ui`).

## Citations

- Preset: `packages/theme/src/tailwind/preset.ts` (content 19-42, withAlpha 49-53, colors 105-323, fontSize 385-403).
- Apps: `apps/portal/tailwind.config.ts`, `packages/ui/tailwind.config.ts`.
- Rules: `AGENTS.md` (Tailwind budget ≤20, no raw hex, light-mode only, glass via @repo/ui).
- Audits: `tools/audits/audit-tailwind-usage.cjs`, `tools/audits/audit-design-tokens.cjs`.
- Stray findings: prior exploration report in this session.

## Next agent actions

1. Decide on safelist vs lookup-map refactor for dynamic classNames (search `${badgeColor}` etc.).
2. Add compact fontSize scale or migrate arbitrary sizes.
3. Run `pnpm audit:tailwind` + `pnpm audit:tokens` after any change; use `--no-verify` only if pre-existing stray files still fail baseline.
