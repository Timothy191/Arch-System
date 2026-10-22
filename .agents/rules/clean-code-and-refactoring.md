---
name: clean-code-and-refactoring
description: 'Concrete code-level rules to keep files clean, predictable, and easy to refactor: constants, guard clauses, immutability, explicit unions, and typed lookups.'
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
alwaysApply: true
---

# Clean Code & Concrete Refactoring Rules

These 10 concrete, code-level rules keep codebases clean, predictable, and maintainable across all packages and apps.

---

## 1. Eliminate Magic Numbers and Strings (Use Named Constants)

Never hardcode raw numbers or arbitrary strings directly into logic—nobody knows what `86400000` or `"STATUS_3"` means months later. Extract them into descriptive, uppercase constants.

### Anti-Pattern (Bad)

```typescript
if (retryCount > 3) {
  wait(86400000);
}
```

### Pattern (Good)

```typescript
const MAX_RETRIES = 3;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

if (retryCount > MAX_RETRIES) {
  wait(ONE_DAY_IN_MS);
}
```

---

## 2. Follow the "Rule of Three" Before Extracting Shared Functions

Don't extract a shared helper the very first time you see similar code—two things that look identical today often evolve in completely different directions tomorrow.

- **1st time**: Just write the code inline.
- **2nd time**: Duplicate it, or note the similarity.
- **3rd time**: Now you understand the true common pattern—extract it into a shared utility function.

---

## 3. Use Guard Clauses (Return Early) Instead of Deep Nesting

Never wrap an entire function body in a massive `if/else` block. Check for invalid conditions or edge cases at the very top of the function and return immediately. Keep the "happy path" flat at the main indentation level.

### Anti-Pattern (Bad)

```typescript
function processOrder(order?: Order) {
  if (order) {
    if (order.isPaid) {
      // 20 lines of actual logic buried in indentation
    }
  }
}
```

### Pattern (Good)

```typescript
function processOrder(order?: Order) {
  if (!order || !order.isPaid) return;
  // 20 lines of clean, unindented logic
}
```

---

## 4. Pass an Options Object Instead of 3+ Positional Arguments

If a function takes more than two or three parameters, especially booleans, calling it becomes an ambiguous guessing game (`createUser("Tim", true, false, true)`). Group parameters into a single typed object so arguments are self-documenting and order-independent.

### Anti-Pattern (Bad)

```typescript
fetchData('/api/items', true, false, 5000);
```

### Pattern (Good)

```typescript
interface FetchDataOptions {
  url: string;
  useCache?: boolean;
  retry?: boolean;
  timeoutMs?: number;
}

fetchData({
  url: '/api/items',
  useCache: true,
  retry: false,
  timeoutMs: 5000,
});
```

---

## 5. Replace Boolean Flags with Explicit Union Types or Enums

A boolean like `isLoading` or `isVerified` quickly breaks down when a third state appears (like `error`, `pending`, or `suspended`), leading to invalid or impossible combinations like `isLoading = true` and `isError = true`.

### Anti-Pattern (Bad)

```typescript
let isLoading = false;
let isError = false;
let isSuccess = true;
```

### Pattern (Good)

```typescript
type RequestStatus = 'idle' | 'loading' | 'success' | 'error';
let status: RequestStatus = 'success';
```

---

## 6. Name Variables by Meaning and Units, Not Just Data Type

Avoid vague names like `data`, `value`, `item`, or `flag`, and don't name things after their type (`userArray`). Include units in numeric variables and auxiliary verbs (`is`, `has`, `can`, `should`) in booleans.

### Anti-Pattern (Bad)

```typescript
const timeout = 30;
const active = true;
const list = [];
```

### Pattern (Good)

```typescript
const timeoutSeconds = 30;
const isAccountActive = true;
const pendingInvoices = [];
```

---

## 7. Default to Immutability (Never Mutate Input Arguments)

Mutating an array or object passed into a function causes invisible bugs and side effects elsewhere in the application. Always treat incoming parameters as read-only and return a new copy instead.

### Anti-Pattern (Bad)

```typescript
function addItem(cart: Item[], newItem: Item) {
  cart.push(newItem); // Mutates the original array!
  return cart;
}
```

### Pattern (Good)

```typescript
function addItem(cart: readonly Item[], newItem: Item): Item[] {
  return [...cart, newItem];
}
```

---

## 8. Replace Complex if/else or switch Chains with Lookup Maps

When mapping one value to another or selecting a handler based on a key, use a dictionary/record lookup instead of a sprawling `if/else` ladder. It is cleaner, faster to read, and enforces exhaustive typing.

### Anti-Pattern (Bad)

```typescript
if (role === 'admin') return '/dashboard/admin';
else if (role === 'operator') return '/dashboard/ops';
else return '/login';
```

### Pattern (Good)

```typescript
const ROLE_ROUTES: Record<UserRole, string> = {
  admin: '/dashboard/admin',
  operator: '/dashboard/ops',
  guest: '/login',
};

return ROLE_ROUTES[role] ?? '/login';
```

---

## 9. One Level of Abstraction Per Function (Do One Thing)

If a function validates raw HTTP headers, calculates business tax, and formats an email string, it is doing too much. A function should either orchestrate high-level steps (calling small helper functions) or execute one specific low-level task—never mix both in the same block.

---

## 10. Never Swallow Errors Silently (Fail Loudly with Context)

An empty `catch (e) {}` or a generic `console.log("error")` is a debugging nightmare. Always either handle the recovery explicitly or rethrow the error wrapped with the context of what the code was trying to do—including relevant IDs, parameters, and causes.

### Anti-Pattern (Bad)

```typescript
try {
  await saveRecord(id, payload);
} catch (e) {
  console.error(e);
}
```

### Pattern (Good)

```typescript
try {
  await saveRecord(id, payload);
} catch (error) {
  throw new Error(`Failed to save record [id=${id}]`, { cause: error });
}
```
