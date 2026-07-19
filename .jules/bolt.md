## 2026-06-25 - Visibility-Gated Popover High-Frequency Updates

**Learning:** Running 1-second intervals for secondary client-side elements (such as an analog clock or live stopwatch) inside background portal layout headers wastes CPU cycles. Gating these timer updates behind the Popover's `open` state completely eliminates background re-rendering when the popover is closed (which is 99% of the time). Immediately synchronizing the state upon opening is critical to prevent a visual lag/stale display.

**Action:** Manage Popover open/close states using a controlled React `useState` hook and conditionally register the high-frequency intervals only when the popover is active. Ensure the state is immediately populated with `new Date()` (or latest snapshot) on opening before the first timer tick occurs.
