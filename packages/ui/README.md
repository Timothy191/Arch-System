# `@repo/ui`

## Storybook

Future Storybook setup will live here. See [docs/wiki/breakdown/code-quality.md](../../docs/wiki/breakdown/code-quality.md) for the implementation plan.

---

### UX Design Principles

The portal follows a concise set of 18 research‑backed UX laws (Jakob's Law, Hick's Law, Fitts's Law, etc.). They guide everything from navigation to button sizing, error handling to progress indicators.

For a quick reference see the **UX Design Rules** document in the repository: `docs/UX_Design_Rules.md`.

#### Component‑to‑UX‑Rule map

The UI library also provides a concise mapping of each component to the UX laws it satisfies. See `docs/UI_Component_UX_Rules.md` for the table.

---

### Accessibility notes (2026‑08‑21)

- **`SecondaryButton`** now includes a visible focus ring via the Tailwind classes:
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2`.
  This ensures keyboard users can easily see which button has focus.
- **`SubmitButton`** (used in forms) now sets `aria‑busy` when the `loading` prop is true. This provides screen‑reader users with feedback that the action is in progress.

Both changes are covered by a single commit and verified by the full `pnpm quality` gate (no lint failures).
