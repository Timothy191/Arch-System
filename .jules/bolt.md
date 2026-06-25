## 2026-06-25 - [Conditional High-Frequency Updates]
**Learning:** High-frequency UI updates (like a 1s clock interval) in background components (Popovers, Modals) can cause significant re-render overhead across the entire app even when not visible.
**Action:** Always make high-frequency intervals or animations conditional on visibility state (e.g., `isOpen`).
