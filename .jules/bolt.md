## 2025-02-18 - Memoizing Derived Data Maps in RevoGrid Components

**Learning:** In high-density data sheets like `HourlyLoadsGrid.tsx`, a lookup Map (`loadsByMachine`) is constructed on every single render to ease cell lookups. Downstream `useCallback` and `useMemo` hooks (such as `getHourValue`, `getMachineTotal`, and `getMaterialType`) reference this Map. When the Map is recreated every render, its reference changes. This invalidates those callbacks on every render, which in turn invalidates the `source` and `columns` dependencies, forcing the heavy `DataGrid` (RevoGrid) wrapper to completely re-render and/or remount on every minor visual change.

**Action:** Always wrap derived Map or Set constructors within a `useMemo` hook if they are referenced inside `useCallback` or `useMemo` arrays, ensuring stable object references across renders.
