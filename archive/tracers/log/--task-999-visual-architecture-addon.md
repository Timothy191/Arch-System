# Task Tracer: Visual Architecture Add-On

- **Date:** 2026-09-17
- **Goal:** Implement the Plantcor Visual Architecture Add-On.
- **Actions Taken:**
  - Supplemented CSS modules: Added `layout.css`, updated `cards.css` (legacy fallbacks, double-beveled edges), and `transitions.css` (hover micro-interactions, hardware acceleration).
  - Updated `index.css` to properly import `layout.css` into the reset layer.
  - Refactored `apps/portal/features/admin/tabs/DepartmentsTab.tsx` to remove dynamic Tailwind utility classes (e.g., `text-${dept.color}-500`) and replaced them with robust CSS variable routing (`--dept-accent`) conforming to strict JIT compilation compatibility.
  - Verified no orphaned `dark:` Tailwind classes remained in the production UI files.
  - Authored `docs/DESIGN_ADDON.md` to permanently document these structural details.
