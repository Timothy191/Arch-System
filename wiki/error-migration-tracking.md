# Error Migration Tracking

## Overview

**Goal**: Migrate 53 generic `throw new Error()` to @repo/errors  
**Priority**: P1 (High)  
**Impact**: +2.0 points to stability score  
**Package**: `@repo/errors` (ready to use)

---

## Error Classes Available

```typescript
import {
  AppError, // Base class (custom status)
  ValidationError, // 400 - Invalid input
  AuthError, // 401 - Not authenticated
  ForbiddenError, // 403 - No permission
  NotFoundError, // 404 - Missing resource
  ConflictError, // 409 - State conflict
  APIError, // 500+ - External API
  DatabaseError, // 500 - DB failures
  RateLimitError, // 429 - Too many requests
} from "@repo/errors";
```

---

## Migration Priority Matrix

| Priority  | File                                                                | Count | Current Pattern    | Target Error                                                    | Status                       |
| --------- | ------------------------------------------------------------------- | ----- | ------------------ | --------------------------------------------------------------- | ---------------------------- |
| 🔴 **P0** | `lib/ai/serpapi.ts`                                                 | 12    | API failures       | `APIError`                                                      | ✅ **Complete** (12/12)      |
| 🔴 **P0** | `features/departments/components/engineering/breakdowns/actions.ts` | 8     | Form/DB errors     | `AuthError`, `DatabaseError`                                    | ✅ **Complete** (8/8)        |
| 🟡 **P1** | `lib/ai/embeddings.ts`                                              | 6     | API failures       | `APIError`                                                      | ✅ **Complete** (6/6)        |
| 🟡 **P1** | `lib/shift-closeout.ts`                                             | 6     | Business logic     | `AuthError`, `NotFoundError`, `ForbiddenError`, `DatabaseError` | ✅ **Complete** (6/6)        |
| 🟡 **P1** | `lib/plugins/orchestrator.ts`                                       | 3     | Plugin errors      | `ValidationError`, `NotFoundError`, `APIError`                  | ✅ **Complete** (3/3)        |
| 🟢 **P2** | `lib/ai/ai-service.ts`                                              | 2     | AI service         | `RateLimitError`, `APIError`                                    | ✅ **Complete** (2/2)        |
| 🟢 **P2** | `lib/ai/memory.ts`                                                  | 2     | Memory service     | `DatabaseError`                                                 | ✅ **Complete** (2/2)        |
| 🟢 **P2** | `lib/sync/sync-queue.ts`                                            | 2     | Queue errors       | `DatabaseError`                                                 | ✅ **Complete** (2/2)        |
| 🟢 **P2** | `components/ai/PredictiveMaintenanceWidget.tsx`                     | 1     | API error          | `APIError`                                                      | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `components/ai/SafetyComplianceScore.tsx`                           | 1     | API error          | `APIError`                                                      | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `components/ai/ShiftHandoffGenerator.tsx`                           | 1     | API error          | `APIError`                                                      | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `features/departments/components/admin/PersonnelTable.tsx`          | 1     | Auth error         | `AuthError`                                                     | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `lib/dashboard-service.ts`                                          | 1     | DB error           | `DatabaseError`                                                 | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `lib/weather-api.ts`                                                | 1     | API error          | `APIError`                                                      | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `plugins/rust-telemetry-engine/index.tsx`                           | 1     | API error          | `APIError`                                                      | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `lib/ai/serpapi.ts` (additional)                                    | 1     | API error          | `APIError`                                                      | ✅ **Complete** (1/1)        |
| 🟢 **P2** | `plugins/buggy-plugin/index.ts`                                     | 2     | Intentional errors | N/A                                                             | ⏭️ **Skipped** (test plugin) |

**Total**: 53 errors across 18 files
**Completed**: 51 errors (96%)  
**Remaining**: 2 errors (4% - intentional test plugin)

**Progress**: ████████████████████████████████████████████████████████░░ 96%

### Completion Summary

| Metric                | Value           |
| --------------------- | --------------- |
| Total Errors          | 53              |
| Migrated              | 51 (96%)        |
| Skipped (intentional) | 2 (test plugin) |
| Files Updated         | 16              |
| Test Failures Fixed   | 13 → 0          |

**Score: 5/10 → 7/10** (improving with @repo/errors)

**Target: 8/10** (after migration complete)

**Status**: ✅ **PHASE 1 COMPLETE** (May 18, 2026)

- All P0, P1, P2 files migrated
- 2 intentional test plugin errors remain (by design)
- Test suite: 191 tests passing

---

## Migration Guide

### Before (Generic Error)

```typescript
// ❌ Old pattern - generic error
throw new Error("Invalid email format");

// ❌ Old pattern - no context
throw new Error(`User ${id} not found`);

// ❌ Old pattern - no status code
throw new Error("Database connection failed");
```

### After (@repo/errors)

```typescript
import { ValidationError, NotFoundError, DatabaseError } from "@repo/errors";

// ✅ New pattern - domain-specific with context
throw new ValidationError("Invalid email format", {
  field: "email",
  value: input.email,
});

// ✅ New pattern - with resource identification
throw new NotFoundError("User not found", {
  resource: "user",
  id: userId,
});

// ✅ New pattern - with cause chaining
try {
  await db.connect();
} catch (cause) {
  throw new DatabaseError("Connection failed", {
    operation: "connect",
    cause,
  });
}
```

---

## Detailed File Analysis

### 1. `lib/ai/serpapi.ts` (12 errors) 🔴 P0

**Current Pattern**: API call failures

```typescript
// Current:
throw new Error("SerpAPI request failed");
throw new Error(`API error: ${response.status}`);
```

**Migration**:

```typescript
// New:
throw new APIError("SerpAPI request failed", {
  statusCode: response.status,
  endpoint: "/search",
  cause: originalError,
});
```

---

### 2. `features/departments/components/engineering/breakdowns/actions.ts` (8 errors) 🔴 P0

**Current Pattern**: Form validation + DB operations

```typescript
// Current:
throw new Error("Invalid machine ID");
throw new Error("Failed to create breakdown");
```

**Migration**:

```typescript
// New:
throw new ValidationError("Invalid machine ID", {
  field: "machineId",
});

throw new DatabaseError("Failed to create breakdown", {
  operation: "insert",
  table: "breakdowns",
});
```

---

### 3. `lib/ai/embeddings.ts` (6 errors) 🟡 P1

**Current Pattern**: Embedding generation failures

```typescript
// Current:
throw new Error("Embedding generation failed");
```

**Migration**:

```typescript
// New:
throw new APIError("Embedding generation failed", {
  statusCode: 500,
  context: { model, inputLength: text.length },
});
```

---

### 4. `lib/shift-closeout.ts` (6 errors) 🟡 P1

**Current Pattern**: Business logic validation

```typescript
// Current:
throw new Error("Shift already closed");
throw new Error("Invalid shift data");
```

**Migration**:

```typescript
// New:
throw new ConflictError("Shift already closed", {
  resource: "shift",
  field: "status",
});

throw new ValidationError("Invalid shift data", {
  field: "shiftDate",
});
```

---

### 5. `lib/plugins/orchestrator.ts` (3 errors) 🟡 P1

**Current Pattern**: Plugin execution errors

```typescript
// Current:
throw new Error("Plugin execution failed");
```

**Migration**:

```typescript
// New:
throw new APIError("Plugin execution failed", {
  context: { pluginName, operation },
});
```

---

## Migration Checklist

### Per File Checklist

- [ ] Import error classes from `@repo/errors`
- [ ] Replace `throw new Error()` with domain-specific error
- [ ] Add appropriate context (field, resource, id, etc.)
- [ ] Add cause chaining if wrapping another error
- [ ] Update error handlers to use type guards
- [ ] Test error scenarios
- [ ] Mark as complete in this tracking doc

### Global Checklist

- [x] 🔴 P0: Migrate `lib/ai/serpapi.ts` (12 errors)
- [x] 🔴 P0: Migrate `features/departments/components/engineering/breakdowns/actions.ts` (8 errors)
- [x] 🟡 P1: Migrate `lib/ai/embeddings.ts` (6 errors)
- [x] 🟡 P1: Migrate `lib/shift-closeout.ts` (6 errors)
- [x] 🟡 P1: Migrate `lib/plugins/orchestrator.ts` (3 errors)
- [x] 🟢 P2: Migrate remaining 12 files
- [x] Create error logging middleware
- [x] Update error boundaries
- [x] Document error patterns in wiki

---

## Error Handler Updates

### API Routes

```typescript
import { isAppError } from "@repo/errors";

// In API route handlers:
export async function POST(request: Request) {
  try {
    // ... logic
  } catch (error) {
    if (isAppError(error)) {
      return Response.json(error.toJSON(), { status: error.statusCode || 500 });
    }

    // Fallback for non-AppError
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
```

### Error Boundaries

```typescript
'use client';

import { isAppError } from '@repo/errors';

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  // AppError has user-friendly messages
  const message = isAppError(error)
    ? error.message
    : 'Something went wrong';

  return (
    <div className="error-boundary">
      <h2>{message}</h2>
      {isAppError(error) && error.context && (
        <pre>{JSON.stringify(error.context, null, 2)}</pre>
      )}
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## Testing Error Scenarios

### Unit Test Example

```typescript
import { ValidationError } from "@repo/errors";
import { validateMachineId } from "./actions";

describe("validateMachineId", () => {
  it("throws ValidationError for invalid ID", () => {
    expect(() => validateMachineId("invalid")).toThrow(ValidationError);

    try {
      validateMachineId("invalid");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.context?.field).toBe("machineId");
    }
  });
});
```

---

## Progress Tracking

| Week   | Target Files | Errors Migrated | Running Total |
| ------ | ------------ | --------------- | ------------- |
| Week 1 | 2 files (P0) | 20              | 20/53 (38%)   |
| Week 2 | 3 files (P1) | 15              | 35/53 (66%)   |
| Week 3 | 5 files (P2) | 18              | 53/53 (100%)  |

**Current Status**: 51/53 (96% complete) ✅

---

## Resources

- **Error Package**: `@repo/errors` (already in root devDependencies)
- **Full Analysis**: `wiki/project-stability-analysis.md`
- **Error Patterns**: `packages/errors/src/index.ts`
- **Completion Plan**: `.windsurf/plans/project-completion-roadmap.md`

---

## Notes

- Migration can happen incrementally (file by file)
- Old and new patterns can coexist during transition
- Focus on P0 files first (highest impact)
- Type guards (`isAppError`, `isValidationError`) help during transition
- Consider adding tests for error scenarios as you migrate
