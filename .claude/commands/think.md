# /think Command

Enforce the Mandatory Thinking Protocol (STM-0) before performing non-trivial mutations:

Execute the 5 phases from `.agents/rules/structured-thinking-mandate.md`:

1. **Phase 1: Situational Comprehension**
   - Restate the task in your own words.
   - Identify affected packages (`apps/portal`, `@repo/*`, `libs/*`).
   - Map against the repository boundary invariants.

2. **Phase 2: Evidence Gathering**
   - Read the actual source code, types, and database migrations.
   - Trace callers and dependents using `rg` or AST grep.
   - Never assume API shapes or props without reading definitions.

3. **Phase 3: Solution Design**
   - Propose candidate approaches and evaluate them against the 5-pillar Real-World Quality Score:
     - Feasibility
     - Maintainability
     - Security
     - Performance
     - Industrial Reliability

4. **Phase 4: Pre-Commit Criticism**
   - Play Devil's Advocate.
   - Check blast radius, breaking changes, and regression risks.
   - If criticism reveals a flaw, revise before touching files.

5. **Phase 5: Execution Contract**
   - List the exact files to modify.
   - Define the verification commands to execute.
   - Proceed with minimal targeted edits.
