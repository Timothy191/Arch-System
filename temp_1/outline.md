# Next.js Modernization & Control Room Features

## 1. High-Level Strategic Vision
Align the Next.js frontend and Server Actions with official Vercel/React 19 patterns while resolving critical technical debt flagged by the UX/UI Audit (Heuristics #1, #2, #5).

## 2. Problem Framing
- Shift closeout reports lack data persistence during browser crashes (Heuristic #5).
- Alarm acknowledgments lack non-destructive undo capabilities (Heuristic #2).
- Server Actions are inconsistently using React 19's native hooks (`useOptimistic`, `useActionState`).

## 3. Scope Breakdown
- **Frontend**: Implement Shadcn toast with Undo capability for alarms. Implement debounced text area for shift notes.
- **Backend (Server Actions)**: Create `autoSaveShiftNote` and `undoAlarmAck` in `apps/portal/lib/`.
- **Infrastructure**: Utilize `@repo/redis` for fast, non-blocking auto-saves.
