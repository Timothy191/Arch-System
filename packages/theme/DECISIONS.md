# @repo/theme — Design Decisions

Architectural decisions for the Arch Systems design token system.
Update this file when making structural changes to the theme package.

---

## 001 — Glass top-border as inline style

**Decision**: The macOS glass top-edge highlight (`borderTop: "1px solid rgba(255,255,255,0.9)"`)
is implemented as a React inline style, not a Tailwind class or CSS file rule.

**Why**: Tailwind cannot express `border-top-color` with an independent opacity modifier — the
`border-t-[rgba(...)]` syntax requires a single value. The CSS token `--glass-border-top` exists
but Tailwind's JIT cannot compose it into a `border-top-color` utility at build time.

**Status**: Accepted pattern. All elevated components (GlassCard, login panels, modals) use this
inline style intentionally. Phase 4 work will absorb this into `.glass-macos` and `.glass` CSS
classes so components no longer need the raw inline style.

**Exemption**: ESLint `react/forbid-component-props` and the Stylelint inline-style rule both
whitelist this specific property.

---

## 002 — `--accent-cyan/indigo/violet` as deprecated aliases

**Decision**: `--accent-cyan`, `--accent-indigo`, and `--accent-violet` all map to `#007aff`
(macOS system blue / `--accent-blue`). They are not distinct colours.

**Why they exist**: Early development used `--accent-cyan` (from a previous dark-mode teal
palette, `rgba(0, 212, 170, 0.x)`). When the macOS light theme replaced it, the tokens were
remapped to `--arch15` (#007aff) but usage was too widespread to remove atomically.

**Migration strategy**: Alias-then-migrate. Stylelint emits a `warning` on any new usage.
Components are migrated as they are touched. No hard codemod (155 references in 47 files).

**Tracking**: `packages/theme/scripts/validate-tokens.mjs` warns on deprecated alias usage in
`preset.ts`. The migration is complete when the warning count reaches zero.

---

## 003 — Light-only `color-scheme: light` as default

**Decision**: `variables.css` defines only a `:root` (light) token set. Dark mode architecture
(`[data-theme="dark"]` block) is scaffolded in Phase 3 but ships disabled.

**Why**: The portal is a mining control-room operational tool. The current requirement is
light-only (macOS Ventura/Sonoma). The dark mode architecture is being built correctly from the
start (data-attribute approach, semantic aliases) so it can be enabled without component rewrites
when the requirement changes.

**Implication**: Components reference only Tier 2 semantic tokens. When the dark block lands, they
automatically update. Zero component changes required.

---

## 004 — Department accent colours as runtime Tailwind classes

**Decision**: Department accent colours (blue, emerald, blue, violet, red, blue, cyan, indigo)
are applied via dynamic Tailwind class strings (e.g. `text-blue-500`) rather than CSS variables.

**Why**: There are 8 departments. Encoding each as a CSS variable set would require 8 × N token
definitions and a data-attribute switch per page. The department colour is only used for icon
tinting, hover borders, and ambient background glows — not for text or semantic purpose.

**Implication**: The dynamic class strings (`text-${dept.color}-500`) must be safelisted in
`tailwind.config.ts` to prevent purging. Turborepo's build task handles this correctly via the
portal's `safelist` configuration.

---

## 005 — `--bg-void` removed

**Decision**: `--bg-void` was an exact alias of `--bg-primary` (both = `var(--arch0)`, `#f5f5f7`).
It has been removed from `variables.css` and `colors.ts`.

**Why**: Having two tokens for the same value creates ambiguity about which to use. `--bg-primary`
is the canonical semantic name. Zero component files referenced `--bg-void` directly.

**Migration**: The Tailwind `bg-void` color utility was removed from `preset.ts`. If any component
was using `bg-[var(--bg-void)]` or `bg-void`, replace with `bg-[var(--bg-primary)]` or
`bg-primary`.

---

## 006 — `shadows.ts` normalised to light-mode values

**Decision**: The JS shadow token values in `shadows.ts` were normalised to match the CSS
`variables.css` light-mode shadow definitions exactly.

**Why**: The previous `shadows.ts` had dark-mode-biased opacity values (`rgba(0,0,0,0.35)`,
`rgba(0,0,0,0.28)`) that would produce overly heavy shadows when used in Framer Motion or runtime
style injection on the light theme.

**Rule**: `variables.css` is the single source of truth. `shadows.ts` is auto-generated from
it via `scripts/generate-tokens.mjs`. The JS values should never be edited manually.

---

## 007 — Token tier system

Three tiers enforced by `scripts/validate-tokens.mjs` and documented inline in `variables.css`:

| Tier           | Tokens                                                                                                       | Rule                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Primitive**  | `--arch0`–`--arch15`                                                                                         | Raw values only. Never referenced in components or `preset.ts` semantic sections. |
| **Semantic**   | `--bg-primary`, `--text-body`, `--shadow-card`, etc.                                                         | All component and utility references. Auto-updated by dark mode.                  |
| **Deprecated** | `--accent-cyan`, `--accent-indigo`, `--accent-violet`, `--accent-alert`, `--accent-blue`, `--accent-emerald` | Map to canonical Tier 2. Stylelint warns. Migrate on touch.                       |

---

## 008 — `tokens` object auto-generated from CSS

**Decision**: `src/tokens/generated.ts` is machine-generated by `scripts/generate-tokens.mjs`
and must not be edited manually.

**Why**: Keeps JS token references (`tokens.color.bg.primary`) always in sync with CSS vars.
Eliminates drift between the CSS source of truth and TypeScript consumers.

**Regenerate**: `pnpm --filter @repo/theme codegen` or `turbo run codegen`.

---

## 009 — Style Dictionary as the single source of truth

**Decision**: `tokens.json` is now the single source of truth for all design tokens.
Style Dictionary generates CSS, TypeScript, and JSON outputs automatically.

**Why**: The previous manual triad (CSS + TS + Tailwind) required editing three files for every
token change. This created drift and maintenance burden. Style Dictionary (industry standard from
Amazon, Salesforce, Adobe) provides a W3C DTCG-compliant token format with automatic multi-platform
output generation.

**Migration**:

- `variables.css` → Now imports `variables-generated.css` (Style Dictionary output)
- `colors.ts` → References updated to use generated values where appropriate
- `tokens.json` → New W3C DTCG format token source file

**Build command**: `pnpm --filter @repo/theme build` or `pnpm codegen`

**Watch mode**: `pnpm tokens:watch` (auto-rebuilds on tokens.json changes)

**Token format**: W3C Design Tokens Community Group (DTCG) specification with references:

```json
{
  "bg": {
    "primary": { "value": "{arch.0}", "type": "color" }
  }
}
```
