# Enforce File Length Limits

**Description:** To ensure code maintainability, readability, and compatibility with AI context windows, all agents and developers must strictly adhere to maximum file length limits.

---

## 1. File Length Constraints

- **Target Size:** Files should ideally not exceed **400-450 lines**.
- **Absolute Limit:** A file MUST NEVER exceed **500 lines** under any circumstances (unless there is absolutely no other way to implement the requirement).

## 2. Refactoring Directives for Agents

- **Proactive Decomposition:** If a feature addition or edit causes a file to approach or exceed the 450-line threshold, you must **stop** and decompose the file.
- **Component Splitting:** For React/UI files, extract large elements into sub-components.
- **Logic Extraction:** Move business logic, state management, and data fetching into separate custom hooks or utility files (e.g., `use[FeatureName].ts`).
- **Type Separation:** Extract large type definitions or Zod schemas into a colocated `types.ts` or `schema.ts` file.

## 3. Enforcement

- This rule applies globally across all workspaces and packages.
- Always check the line count of a file before committing substantial additions.
