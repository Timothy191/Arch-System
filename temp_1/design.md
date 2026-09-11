# Technical Architecture & Design

## 1. Next.js App Router & React 19 Integration
- **Server Actions**: Defined in `apps/portal/lib/` with strict `"use server"` directives.
- **Optimistic UI**: Implement `useOptimistic` for immediate UI feedback on alarm toggles while the Server Action executes in the background.
- **Error Handling**: Use `@repo/errors` (e.g., `ValidationError`, `DatabaseError`) in actions, serialized to `error` properties for the client.

## 2. Data Models & Cache
- **Auto-Save Cache Key**: `arch:autosave:shift:${employee_id}`
- **Data Shape**: `{ content: string, timestamp: ISO8601 }`

## 3. Component Architecture
- `ShiftCloseoutForm.tsx` (Client Component): Uses `useDebounce` and invokes `autoSaveShiftNote(content)`.
- `AlarmCard.tsx` (Client Component): Dispatches toast with `action: <ToastAction onClick={() => undoAlarmAck(alarmId)}>Undo</ToastAction>`.
