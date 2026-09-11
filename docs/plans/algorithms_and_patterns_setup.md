# Algorithms & Patterns Setup

## Summary
Establish a central `algorithms_and_patterns` directory in the repository to serve as the unified knowledge base for standard algorithms and design patterns (derived from `TheAlgorithms/Java` and related repos for TS/Python/Rust). Define an index file to enforce token-efficient reading for all agents.

## Problem
Agents currently lack a centralized, token-efficient reference for standard algorithms and design patterns. This leads to inconsistent implementations, hallucinated algorithms, and wasted tokens researching basic patterns across different tech stacks.

## Requirements
- The system shall maintain an `algorithms_and_patterns` directory at the project root.
- The system shall contain a `algorithms_and_patterns/INDEX.md` file optimized for token-efficient reading.
- The system shall categorize algorithms by language/stack (Java, TypeScript, Python, Rust, SQL).
- The system shall enforce that all AI agents permanently read `algorithms_and_patterns/INDEX.md` as part of their global context.

## Key Technical Decisions
1. **Directory Structure:** Use `algorithms_and_patterns/` to avoid shell escaping issues with `&`.
2. **Index File:** `INDEX.md` will contain a structured map of pointers to specific algorithm files rather than holding all algorithms in one giant file, ensuring agents only read what they need.
3. **Agent Enforcement:** Update `docs/AGENTS.md` and/or `policy-compiler.cjs` to globally inject `algorithms_and_patterns/INDEX.md` into the agent context rules.

## Implementation Units
1. **Scaffold Directory & Index:** Create `algorithms_and_patterns/INDEX.md` and subdirectories (`Java/`, `TypeScript/`, `Python/`, `Rust/`, `SQL/`).
2. **Populate Core Java Algorithms:** Extract key structural patterns from `TheAlgorithms/Java` (e.g., Sorting, Searching, Data Structures) and create reference stubs.
3. **Populate Other Tech Stacks:** Create equivalent reference stubs for TS (Next.js patterns), Python (Eval suite patterns), Rust (Swarms-rs patterns), and SQL (PostgreSQL RLS patterns).
4. **Enforce Global Agent Rule:** Modify the global Agent instructions (e.g., append a rule to `AGENTS.md` or `.gemini/config/rules/`) so agents automatically load `algorithms_and_patterns/INDEX.md`.
