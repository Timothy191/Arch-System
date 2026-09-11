# Computational Problem Solving & Algorithmic Thinking

> **REFERENCE SOURCE**: MathWorks *Fundamentals of Programming* & Algorithmic Engineering Standards.

---

## 1. The 5-Step Computational Problem-Solving Pipeline

Every algorithmic task should follow a disciplined, top-down decomposition pipeline before writing code:

```
+------------------+     +------------------+     +------------------+
| 1. Problem       | --> | 2. Mathematical  | --> | 3. Pseudo-Code   |
|    Framing       |     |    Model         |     |    Decomposition |
+------------------+     +------------------+     +------------------+
                                                            |
                                                            v
+------------------+     +------------------+     +------------------+
| 6. Complexity &  | <-- | 5. Verification  | <-- | 4. Modular Code  |
|    Optimization  |     |    & Edge Cases  |     |    Implementation|
+------------------+     +------------------+     +------------------+
```

1. **Problem Framing**: Explicitly isolate inputs, desired outputs, boundary constraints, and error modes.
2. **Mathematical / Logical Model**: Translate business logic into deterministic algebraic or logical formulations.
3. **Pseudo-Code Decomposition**: Outline steps sequentially, identifying loops, branches, and state variables without language-specific syntax.
4. **Modular Implementation**: Write small, pure functions with unambiguous type contracts and zero side effects.
5. **Verification & Edge Testing**: Test boundary conditions (empty arrays, negative numbers, overflow boundaries, zero-length strings).
6. **Complexity & Optimization**: Measure execution time and space scaling before refactoring.

---

## 2. Asymptotic Complexity (Big-O Analysis)

Always evaluate the time and space complexity of computational algorithms:

| Complexity | Common Name | Example Operation | Performance Profile |
| :--- | :--- | :--- | :--- |
| **$O(1)$** | Constant | Hash map lookup, array index access | Optimal, scale-invariant |
| **$O(\log n)$** | Logarithmic | Binary search, balanced tree traversal | Extremely fast, doubles work only when input squares |
| **$O(n)$** | Linear | Single-pass array scan, linear search | Standard baseline |
| **$O(n \log n)$** | Linearithmic | Merge sort, Quick sort (average), FFT | Optimal comparison sorting |
| **$O(n^2)$** | Quadratic | Nested loops, bubble sort, pairwise comparisons | Unacceptable for large datasets ($n > 10,000$) |
| **$O(2^n)$** | Exponential | Naive recursive Fibonacci, subset generation | Intractable; requires dynamic programming |

---

## 3. Algorithmic Problem-Solving Strategies

### A. Divide and Conquer
Decompose a complex problem into independent sub-problems, solve sub-problems recursively or iteratively, and combine results.
- **Applications**: Merge sort, binary search, fast Fourier transform (FFT).

### B. Greedy Approaches
Make the locally optimal choice at each step with the intent of reaching a global optimum.
- **Criteria**: Problem must exhibit the greedy-choice property and optimal substructure.
- **Applications**: Dijkstra's shortest path, Kruskal's minimum spanning tree, Huffman coding.

### C. Dynamic Programming (Memoization & Tabulation)
Solve overlapping subproblems once and store their solutions in a lookup table.
- **Applications**: Sequence alignment, shortest paths with negative edges, knapsack optimization.

---

## 4. Engineering Edge Cases & Contracts
- **Empty & Singleton Inputs**: Ensure algorithms return sensible defaults or throw specific contract errors on zero elements.
- **Precision & Floating-Point Drift**: In numerical simulations, avoid exact equality `a == b` on floats; use `abs(a - b) < epsilon`.
- **Preallocation**: Never grow arrays dynamically inside high-frequency loops; preallocate memory to prevent costly reallocation and garbage collection churn.
