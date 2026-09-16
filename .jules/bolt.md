## 2025-05-18 - Side-effects in setState callbacks during Event Listener optimization
**Learning:** Avoid placing side-effects (like navigation or actions) inside React `setState` updater functions to prevent re-subscribing event listeners. React's Strict Mode and concurrent features invoke updater callbacks multiple times per render cycle, triggering duplicate side-effects.
**Action:** Use a `useRef` (e.g. `selectedIndexRef.current = selectedIndex`) to hold stable references for window/DOM event listeners instead of executing side-effects within state updater callbacks.
