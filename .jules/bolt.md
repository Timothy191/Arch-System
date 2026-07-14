## 2026-07-14 - Optimize SystemClock
**Learning:** High-frequency UI updates like a 1s clock interval can cause significant background re-render overhead. Visibility gating using popover state can eliminate 98% of these updates when the UI is not visible.
**Action:** Use 'isOpen' state or visibility observers to gate high-frequency intervals in UI components.
