## 2026-03-01 - Avoid Micro-Optimizing Small Daily/Monthly Rollup Arrays
**Learning:** Optimizing array iterations (e.g. replacing multiple `.reduce()` calls with `for...of` loops) on small datasets such as monthly rollup days (max 28–31 items) provides no measurable performance improvement and risks being classified as premature micro-optimization.
**Action:** Focus performance optimizations strictly on high-frequency rendering components, virtualized lists, or large raw dataset transformations (e.g. multi-thousand row telemetry logs, hourly load matrices, SCADA feeds, or heavy Map lookups).
