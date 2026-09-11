# Data Structures & Memory Layouts

> **REFERENCE SOURCE**: MathWorks *Fundamentals of Programming* & High-Performance Data Engineering.

---

## 1. Linear Data Structures & Cache Locality

### A. Arrays & Memory Contiguity
- **Contiguous Allocation**: Arrays store elements in contiguous memory blocks, maximizing CPU L1/L2 cache line hits.
- **Preallocation Principle**:
  - In dynamic arrays (e.g. JavaScript Arrays, Python lists, MATLAB matrices), repeated `push` or incremental resizing forces $O(n)$ reallocations and copies.
  - **Rule**: Always preallocate arrays of fixed size `new Array(size)` or pre-sized buffers when the upper bound is known.

### B. Vectorization vs Scalar Loops
Vectorized operations apply single-instruction transformations across entire data arrays simultaneously (SIMD) rather than evaluating element-by-element in userland loops.
- **Pattern**:
  ```typescript
  // BAD: Scalar loop with repeated push and reallocations
  const results: number[] = [];
  for (let i = 0; i < telemetry.length; i++) {
    results.push(telemetry[i] * factor);
  }

  // GOOD: Vectorized typed array mapping with preallocation
  const count = telemetry.length;
  const out = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = telemetry[i] * factor;
  }
  ```

---

## 2. Associative Structures (Hash Maps & Sets)

- **Mechanics**: Hash function computes integer bucket index from arbitrary keys ($O(1)$ amortized access).
- **Collision Resolution**: Handled via separate chaining (linked list / tree buckets) or open addressing (linear/quadratic probing).
- **Best Practice in Multi-Agent State**:
  - Use `Map<string, T>` for key-value state dictionaries where keys are dynamic.
  - Use `Set<string>` for membership assertions and deduplication filters ($O(1)$ check vs $O(n)$ array `includes`).

---

## 3. Hierarchical Structures (Trees & Graphs)

### A. Trees
- **Binary Search Tree (BST)**: Left child $\le$ Node $<$ Right child. Search/Insert in $O(\log n)$ average, $O(n)$ worst-case unbalanced.
- **Balanced Trees (AVL, Red-Black)**: Enforce balance factor via self-balancing rotations to guarantee $O(\log n)$ operations.

### B. Graphs
- **Representations**:
  - **Adjacency Matrix**: $V \times V$ matrix. Optimal for dense graphs ($O(1)$ edge lookup, $O(V^2)$ memory).
  - **Adjacency List**: Map of vertex $\to$ array of neighbors. Optimal for sparse graphs ($O(V + E)$ memory).
- **Traversal Paradigms**:
  - **Breadth-First Search (BFS)**: Uses a Queue ($O(V + E)$). Guarantees shortest path in unweighted graphs.
  - **Depth-First Search (DFS)**: Uses a Stack / Recursion ($O(V + E)$). Ideal for cycle detection, topological sorting, and path connectivity.
