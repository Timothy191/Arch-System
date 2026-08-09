# Bolt's Performance Journal

This journal records critical performance insights, failed optimizations, codebase-specific anti-patterns, and key architectural learnings to guide future optimization work.

## 2026-08-09 - High-Frequency Background Timer Overhead & Visibility Gating
**Learning:** In high-density monitoring applications, standard React intervals (e.g. `setInterval(fn, 1000)`) inside deeply-nested components run continuously in the background, triggering full component re-renders even when their visual components (such as Radix UI Popovers or Modals) are closed and invisible. This wastes client-side CPU cycles and degrades overall UI responsiveness.
**Action:** Always gate high-frequency timers (1s or faster) based on component visibility or Popover open states (`isOpen`), and perform immediate state synchronization on open to eliminate rendering lag.
