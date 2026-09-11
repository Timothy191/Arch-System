# Procedural Flow Control & Recursion

> **REFERENCE SOURCE**: MathWorks *Fundamentals of Programming* & Formal Verification Standards.

---

## 1. Structured Control Flow & Branching

### A. Guard Clauses & Early Returns
Avoid deeply nested `if/else` ladders by verifying prerequisites at the function entry:
```typescript
// BAD: Deep nesting
function processShift(shift: Shift | null) {
  if (shift) {
    if (shift.status === "open") {
      if (shift.supervisorId) {
        return closeShift(shift);
      }
    }
  }
  return null;
}

// GOOD: Guard clauses with early returns
function processShift(shift: Shift | null) {
  if (!shift || shift.status !== "open" || !shift.supervisorId) {
    return null;
  }
  return closeShift(shift);
}
```

### B. State Machine Transitions
When modeling complex asynchronous workflows (e.g. SCADA telemetry synchronization, shift closeouts), replace boolean flags with explicit state machines:
- Define discrete states: `IDLE`, `CONNECTING`, `STREAMING`, `DEGRADED`, `CLOSED`.
- Prevent illegal transitions (e.g. `CLOSED` $\to$ `STREAMING` without explicit reopening).

---

## 2. Iteration, Invariants & Termination Proofs

Every loop construct must possess:
1. **Initialization**: Loop variables set to well-defined initial conditions before first iteration.
2. **Loop Invariant**: A condition that remains true before and after each iteration.
3. **Termination Condition**: A strictly monotonic decrementing/incrementing measure guaranteeing the loop terminates in finite steps ($k < \text{maxSteps}$).

```typescript
// Deterministic bounded loop pattern
let step = 0;
const MAX_BOUND = 1000;
while (hasWork && step < MAX_BOUND) {
  step++;
  hasWork = executeBatch();
}
if (step >= MAX_BOUND) {
  throw new Error("Loop aborted: step ceiling exceeded");
}
```

---

## 3. Recursion vs Iteration

### A. Core Anatomy of Recursion
1. **Base Case**: The stopping criteria that returns a value without making further recursive calls.
2. **Recursive Step**: The self-referential call with arguments strictly moving toward the base case.

### B. Call-Stack Budgets & Tail-Call Optimization
- Each recursive frame consumes stack memory ($O(D)$ where $D$ is recursion depth).
- Deep recursion ($D > 10,000$) causes fatal Stack Overflow errors in JavaScript/V8.
- **Rule**: If recursion depth is unbounded or dependent on user input size, convert to an iterative loop using an explicit stack array allocated on the heap.

```typescript
// Iterative depth-first traversal avoiding stack overflow
function traverseIterative(root: TreeNode): void {
  const stack: TreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    processNode(node);
    if (node.right) stack.push(node.right);
    if (node.left) stack.push(node.left);
  }
}
```
