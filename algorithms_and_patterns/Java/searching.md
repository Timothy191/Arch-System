# Java Searching Algorithms (Reference Specifications)

> **STANDARD REFERENCE**: Canonical search algorithms, graph traversals, and logarithmic lookup mechanisms.

---

## 1. Complexity Comparison Matrix

| Algorithm                      | Data Requirement        | Time Complexity (Avg) | Time Complexity (Worst) | Space Complexity |
| :----------------------------- | :---------------------- | :-------------------: | :---------------------: | :--------------: |
| **Linear Search**              | Unsorted array / stream |        $O(n)$         |         $O(n)$          |      $O(1)$      |
| **Binary Search**              | Sorted array / index    |      $O(\log n)$      |       $O(\log n)$       |      $O(1)$      |
| **Jump Search**                | Sorted array            |     $O(\sqrt{n})$     |      $O(\sqrt{n})$      |      $O(1)$      |
| **Breadth-First Search (BFS)** | Graph / Tree            |      $O(V + E)$       |       $O(V + E)$        |      $O(V)$      |
| **Depth-First Search (DFS)**   | Graph / Tree            |      $O(V + E)$       |       $O(V + E)$        |      $O(V)$      |

---

## 2. Binary Search (Iterative & Boundary Safe)

```java
public class BinarySearch {
    public static int search(int[] sortedArray, int target) {
        if (sortedArray == null || sortedArray.length == 0) return -1;

        int left = 0;
        int right = sortedArray.length - 1;

        while (left <= right) {
            // Avoid integer overflow: (left + right) >>> 1 or left + (right - left) / 2
            int mid = left + (right - left) / 2;

            if (sortedArray[mid] == target) {
                return mid;
            } else if (sortedArray[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return -1; // Target not found
    }
}
```

---

## 3. Graph Traversal: Breadth-First & Depth-First Search

```java
import java.util.*;

public class GraphSearch {
    private final Map<Integer, List<Integer>> adjList = new HashMap<>();

    public void addEdge(int source, int destination) {
        adjList.computeIfAbsent(source, k -> new ArrayList<>()).add(destination);
    }

    // Breadth-First Search (Shortest path in unweighted graphs)
    public List<Integer> bfs(int startNode) {
        List<Integer> visitedOrder = new ArrayList<>();
        Set<Integer> visited = new HashSet<>();
        Queue<Integer> queue = new LinkedList<>();

        queue.add(startNode);
        visited.add(startNode);

        while (!queue.isEmpty()) {
            int current = queue.poll();
            visitedOrder.add(current);

            for (int neighbor : adjList.getOrDefault(current, Collections.emptyList())) {
                if (!visited.contains(neighbor)) {
                    visited.add(neighbor);
                    queue.add(neighbor);
                }
            }
        }

        return visitedOrder;
    }
}
```
