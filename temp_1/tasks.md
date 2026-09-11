# Execution Waves

## Wave 1: Next.js Server Actions Infrastructure
- [ ] Implement `autoSaveShiftNote` Server Action in `apps/portal/lib/shift-closeout.ts`.
- [ ] Implement `undoAlarmAck` Server Action.
- [ ] Standardize return types (`{ success, error }`) on targeted actions using Vercel guidelines.

## Wave 2: Frontend Client Components
- [ ] Integrate debounced auto-save into the Shift Closeout view.
- [ ] Implement Undo toast action on the Alarm Acknowledgment flow.

## Wave 3: Audit Documentation Updates
- [ ] Mark Heuristic #2 and #5 as `[DONE]` in `docs/reports/UX_UI_AUDIT.md`.
- [ ] Run `pnpm quality` to verify strict boundaries and type safety.
