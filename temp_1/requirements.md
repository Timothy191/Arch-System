# Functional Requirements (EARS Notation)

## 1. Shift Closeout Auto-Save
- **Normal**: WHEN a user types in the shift closeout note field and pauses for 1000ms, THE SYSTEM SHALL invoke a background Server Action to auto-save the content to Redis.
- **Normal**: WHEN the user returns to the shift closeout page after a crash, THE SYSTEM SHALL pre-load the auto-saved draft from Redis.
- **Error Path**: WHEN the Redis connection fails during auto-save, THE SYSTEM SHALL silently catch the error and queue a retry, without interrupting the user's typing.

## 2. Alarm Acknowledgment Undo
- **Normal**: WHEN an alarm is acknowledged, THE SYSTEM SHALL render a toast notification containing an 'Undo' button for 5 seconds.
- **Normal**: WHEN the 'Undo' button is clicked within the timeout, THE SYSTEM SHALL execute a Server Action reverting the alarm status to 'active'.
- **Edge Case**: WHEN the 5-second timeout expires, THE SYSTEM SHALL permanently commit the acknowledgment.

## 3. Server Action Standardization
- **Normal**: WHEN any Next.js Server Action executes, THE SYSTEM SHALL enforce a strict try/catch block and return `{ success: boolean, data?: unknown, error?: string, code?: string }`.
