# Graph Data Structures (Algorithms)

When reports detail the actual data architecture or algorithmic performance, they outline Graph Data Structures—mathematical models consisting of nodes (vertices) and edges (connections).

## Overview

Graph data structures model relationships in data systems. They are fundamental to distributed systems, dependency management, networking, and algorithmic problem-solving.

## Core Concepts

### Nodes (Vertices) & Edges

**Nodes:** Individual entities in the system

- Functions, variables, microservices
- Database tables, API endpoints
- Agents, tasks, workflows

**Edges:** Connections between nodes

- Function calls, dependencies
- Data flow, messages
- Relationships, constraints

### Graph Properties

**Directed vs. Undirected:**

```
Directed:        Undirected:
A → B            A ─ B
↓   ↑            │   │
C → D            C ─ D

(arrows show direction)
```

**Weighted vs. Unweighted:**

```
Weighted:           Unweighted:
A --(5)-- B         A ─── B
│  (3)   │          │     │
│        │          │     │
C --(7)-- D         C ─── D

(numbers are edge weights: cost, latency, capacity)
```

**Cyclic vs. Acyclic:**

```
Cyclic:         Acyclic (DAG):
A ─ B           A ─ B
├─ C            └─ D
└─ A (cycle)
                (no cycles)
```

## Representation Methods

### Adjacency Matrix

**Definition:** 2D array where `matrix[i][j]` represents edge from node i to node j

**Example:**

```
       A  B  C  D
    A [0, 1, 0, 1]
    B [0, 0, 1, 0]
    C [0, 0, 0, 1]
    D [1, 0, 0, 0]

Graph: A→B, A→D, B→C, C→D, D→A
```

**Advantages:**

- Fast edge lookup: O(1)
- Matrix operations possible
- Symmetric for undirected graphs

**Disadvantages:**

- Memory: O(n²) even for sparse graphs
- Inefficient for large graphs
- Adding nodes requires reallocation

**Use Cases:**

- Highly connected graphs (flights between cities)
- Matrix-based algorithms (Floyd-Warshall shortest path)
- Dense networks

### Adjacency List

**Definition:** Dictionary/map where each node has a list of adjacent nodes

**Example:**

```
A: [B, D]
B: [C]
C: [D]
D: [A]

TypeScript:
type AdjacencyList = Map<string, string[]>;
const graph = new Map([
  ['A', ['B', 'D']],
  ['B', ['C']],
  ['C', ['D']],
  ['D', ['A']]
]);
```

**Advantages:**

- Memory efficient: O(n + m) where m = edges
- Iterating neighbors is fast
- Flexible for sparse graphs
- Easy to add nodes

**Disadvantages:**

- Edge lookup slower: O(degree)
- Less suitable for matrix operations
- Harder to implement undirected graphs

**Use Cases:**

- Social networks (sparse connections)
- Dependency graphs
- Web crawlers
- Routing algorithms

## Graph Algorithms

### Breadth-First Search (BFS)

**Purpose:** Explore graph level-by-level; find shortest path in unweighted graphs

**Algorithm:**

```
1. Start at source node
2. Add to queue
3. Dequeue node → mark as visited
4. Enqueue all unvisited neighbors
5. Repeat until queue empty
```

**Applications:**

- Shortest path (unweighted)
- Level-order traversal
- Connected components
- Social networks (degrees of separation)

**Complexity:**

- Time: O(n + m) where n = nodes, m = edges
- Space: O(n) for queue and visited set

**Example (Finding distance to node):**

```
BFS from A to find distances:

Start: A (distance 0)
  Enqueue neighbors: B (1), D (1)
Process B: Enqueue C (2)
Process D: Enqueue nothing new
Process C: Done

Result: A→0, B→1, D→1, C→2
```

### Depth-First Search (DFS)

**Purpose:** Explore deeply before backtracking; detect cycles, topological sort

**Algorithm:**

```
1. Start at source node → mark visited
2. Recursively visit each unvisited neighbor
3. Backtrack when no unvisited neighbors
```

**Applications:**

- Cycle detection
- Topological sorting (task dependencies)
- Strong connected components
- Maze solving
- Back-edge detection (cycle in directed graph)

**Complexity:**

- Time: O(n + m)
- Space: O(n) for recursion stack

**Example (Topological sort for task scheduling):**

```
Tasks: A, B, C, D
Dependencies: B→A, C→A, D→B, D→C

DFS to find order:
Start D → B → A (visit) → backtrack
      → C → A (already visited)

Result: D, B, C, A (or D, C, B, A)
Execute in reverse: A, C, B, D ✓
```

### Dijkstra's Algorithm

**Purpose:** Find shortest path in weighted graphs (non-negative weights)

**Algorithm:**

```
1. Start at source, distance = 0
2. Maintain min-heap of unvisited nodes by distance
3. Visit closest unvisited node
4. Update distances to neighbors if shorter path found
5. Repeat until destination reached or all visited
```

**Applications:**

- Route planning (GPS, networks)
- Network routing protocols
- Game AI pathfinding
- Social network closeness

**Complexity:**

- Time: O((n + m) log n) with binary heap
- Space: O(n)

**Example (Shortest route):**

```
    [1]
   A ------- B
   |        /|
[2]|[1]  [3]|[2]
   |    /    |
   C---------D
   [4]

Shortest path A→D:
Option 1: A→B→D = 1 + 2 = 3
Option 2: A→C→D = 2 + 4 = 6
Option 3: A→B→C→D = 1 + 1 + 4 = 6

Result: A→B→D (cost 3)
```

### Topological Sort

**Purpose:** Order nodes in acyclic graph such that dependencies are respected

**Algorithm:**

- DFS-based: track finish times, reverse output
- Kahn's algorithm: repeatedly remove nodes with no dependencies

**Applications:**

- Task scheduling
- Build system dependency order
- Package manager resolution
- Workflow orchestration

**Example (Project build order):**

```
Dependencies:
  compile → test → package → deploy

Topological order: compile, test, package, deploy
(Each must complete before next starts)
```

## Real-World Applications in Arch-Mk2

### 1. Agent Orchestrator

**Graph Model:**

```
Nodes: Agents, tasks, MCP tools
Edges: Agent calls, task dependencies, tool invocations

Query: "Execute Agent A, then B, then C in sequence"
Use DFS/Topological sort to determine execution order
```

### 2. N8N Workflow Engine

**Graph Model:**

```
Nodes: Workflow steps
Edges: Transitions between steps

Query: "What's the critical path (longest chain)?"
Use Dijkstra variant to find path with max time
```

### 3. Microservice Dependency Analysis

**Graph Model:**

```
Nodes: Services (portal, cms, database, cache)
Edges: HTTP calls, async messages

Query: "Which services are tightly coupled?"
Use connected components analysis
```

### 4. Supabase RLS & Auth Flows

**Graph Model:**

```
Nodes: Users, roles, tables, policies
Edges: Has-role, can-access, depends-on

Query: "Can user X access table Y through role Z?"
BFS/reachability analysis
```

### 5. Package Dependency Resolution

**Graph Model:**

```
Nodes: npm packages
Edges: Depends-on relationships

Query: "Detect circular dependencies?"
DFS cycle detection

Query: "Find optimal install order?"
Topological sort
```

## Implementation Examples

### TypeScript: Adjacency List

```typescript
class Graph<T> {
  private adjacencyList: Map<T, T[]> = new Map();

  addNode(node: T) {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, []);
    }
  }

  addEdge(from: T, to: T) {
    this.addNode(from);
    this.addNode(to);
    this.adjacencyList.get(from)!.push(to);
  }

  // BFS shortest path
  bfs(start: T, end: T): T[] | null {
    const visited = new Set<T>();
    const queue: T[] = [start];
    const parent = new Map<T, T | null>();

    parent.set(start, null);

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);

      if (node === end) {
        const path: T[] = [];
        let current: T | null = end;
        while (current !== null) {
          path.unshift(current);
          current = parent.get(current) || null;
        }
        return path;
      }

      for (const neighbor of this.adjacencyList.get(node) || []) {
        if (!visited.has(neighbor)) {
          parent.set(neighbor, node);
          queue.push(neighbor);
        }
      }
    }

    return null;
  }
}
```

## Performance Comparison

| Operation      | Adjacency Matrix | Adjacency List |
| -------------- | ---------------- | -------------- |
| Edge lookup    | O(1)             | O(degree)      |
| Find all edges | O(n²)            | O(n + m)       |
| Add node       | O(n²)            | O(1)           |
| Add edge       | O(1)             | O(1)           |
| Memory         | O(n²)            | O(n + m)       |
| BFS/DFS        | O(n²)            | O(n + m)       |

## Best Practices

1. **Choose representation wisely** — Use adjacency list for sparse graphs (typical)
2. **Cycle detection** — Run before scheduling/sequencing
3. **Memoization** — Cache shortest paths, connectivity results
4. **Incremental updates** — Maintain graph state, don't rebuild from scratch
5. **Visualization** — Use graphing tools for debugging (D3, Graphviz)

## See Also

- [Conceptual Code Graphs](./conceptual-code-graphs.md) — ASTs, CFGs, and program analysis
- [Visual Graphs for Reporting](./visual-graphs-reporting.md) — Data visualization techniques
- [Git Tree History](./README.md) — Project structure and architecture
