## 2026-06-24 - [Optimizing Hidden Components]
**Learning:** High-frequency intervals (e.g., 1s for a clock) cause unnecessary re-renders when the UI they update is hidden (inside a closed Popover/Modal).
**Action:** Use the `open` state of the container to conditionally enable intervals. Ensure all hooks are declared before any conditional returns to avoid breaking React's hook order rules.

## 2026-06-24 - [Avoid Catalog Resolution Removal]
**Learning:** Modifying `package.json` in an Nx/pnpm workspace can inadvertently remove `catalog:` resolutions if using automated tools or manual edits without care, breaking monorepo dependency management.
**Action:** Never modify `package.json` unless explicitly instructed, and always verify `catalog:` references remain intact.
