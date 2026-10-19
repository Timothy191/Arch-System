# Algorithms & Patterns Index (Arch-System SSoT)

> **AGENT DIRECTIVE**: This index is the Single Source of Truth (SSoT) for standard algorithms, architectural patterns, and domain invariants across Arch-System. Load only the specific sub-files required for your task to conserve context tokens.

---

## 📐 Fundamentals of Computational Problem Solving

- [Computational Problem Solving & Big-O Analysis](Fundamentals/problem-solving.md) — 5-step decomposition pipeline, asymptotic bounds ($O(1)$ to $O(2^n)$), complexity matrix.
- [Data Structures & Memory Contiguity](Fundamentals/data-structures.md) — Contiguous buffers, dynamic arrays, hash tables, linked nodes.
- [Procedural Flow Control, Iteration & Recursion](Fundamentals/control-flow-and-recursion.md) — Iterative versus recursive patterns, base-case safety, tail-call characteristics.

---

## 📘 TypeScript / Next.js (Apps & UI Monorepo)

- [Next.js 16 & React 19 Architectural Patterns](TypeScript/nextjs-patterns.md)
  - React Server Components (RSC) by default; leaf Client Components (`'use client'`).
  - Next.js 16 Cache Components (`'use cache'` + `cacheLife()`) & Redis Two-Tier L1/L2 integration.
  - Server Action RPC 7-step pipeline (Auth $\to$ Role $\to$ Contract $\to$ Rate Limit $\to$ Mutation $\to$ Revalidate $\to$ Redirect).
  - Heavy library dynamic code-splitting (`next/dynamic` with `{ ssr: false }`).
  - Type-safe Event Manager (`dispatchActiveModuleChange`, `dispatchSystemNotification`).
  - Single-Flight Promise Coalescing to prevent cache stampedes.
  - Edge Telemetry Circuit Breaker (`CLOSED` $\to$ `OPEN` $\to$ `HALF_OPEN`).

---

## 🗄️ SQL & PostgreSQL (Database & Supabase)

- [PostgreSQL RLS & Schema Patterns](SQL/rls-patterns.md)
  - Mandatory Row Level Security invariant (`ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;`).
  - Subquery InitPlan optimization: `(SELECT auth.uid())` ($O(1)$ query-level cache vs $O(N)$ row-level evaluation).
  - Role-Based Access Control (RBAC) helpers (`public.is_admin()`, `public.has_department_access()`).
  - PL/pgSQL secure function signature: `SECURITY DEFINER SET search_path = public, pg_temp`.
  - Atomic RPC transactions with row-level locks (`FOR UPDATE`).
  - Time-series monthly range partitioning for high-throughput sensor telemetry.
  - pgvector HNSW indexing and hybrid semantic + full-text search.

---

## 🐍 Python & Evaluation Suites

- [LLM Evaluation Suite & Metric Patterns](Python/eval-patterns.md)
  - `uv` sub-second environment and pytest test harnesses in `packages/eval/`.
  - Deterministic AST compliance metrics (`design_system_compliance`, `supabase_import_compliance`).
  - Factual consistency and hallucination scoring against ground-truth mining manuals.
  - Golden dataset schemas and Langfuse token budget guards.

---

## 🦀 Rust & Distributed Systems

- [Rust Swarms-rs & Telemetry Ingestion Patterns](Rust/swarms-patterns.md)
  - Multi-agent topologies: Coordinator, Worker, Reviewer actors via `swarms-rs`.
  - Tokio async channels (bounded MPSC) with backpressure for edge sensor telemetry.
  - Deterministic circuit breaker state machine pattern.

---

## 💛 JavaScript & Runtime Utility Algorithms

- [JavaScript Algorithms & Utilities](JavaScript/algorithms-overview.md) — Reference implementations, binary search, heap priority queue, debounce/throttle.
- [Repository Integration Analysis](INTEGRATION-ANALYSIS.md) — Comparative evaluation of algorithmic libraries.

---

## ☕ Java Reference Implementations

- [Sorting Algorithms](Java/sorting.md) — QuickSort, MergeSort, HeapSort, InsertionSort with complexity profiles.
- [Search Algorithms](Java/searching.md) — Binary Search, Jump Search, BFS/DFS graph search.
