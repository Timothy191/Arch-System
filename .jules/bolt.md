# Bolt's Performance Journal

## 2026-07-21 - Gating High-Frequency Intervals & Testing Under Localized Timezones

**Learning:** When optimizing visibility-gated, high-frequency interval updates (e.g., analog clocks/tickers), we must ensure immediate synchronization upon component opening to prevent visual lag or staleness. When writing unit tests for such components, using hardcoded time strings (like `12:00:01`) can fail on CI/CD machines or container test runners if the default system timezone is configured to UTC, while the browser-targeted component utilizes `toLocaleTimeString` without explicit timezones for certain sub-elements.

**Action:** Consolidate state synchronization and `setInterval` setup into a single `useEffect` gated on visibility state (`isOpen`). When writing unit assertions on timezone-sensitive outputs formatted without explicit timezones, dynamically construct expected strings using `Date.toLocaleTimeString([], ...)` to natively align runner and component timezones.
