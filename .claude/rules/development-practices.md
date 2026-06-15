# Development Practices

## Codebase Exploration

Use the codebase memory MCP (`mcp__codebase-memory-mcp__search_graph`, `mcp__codebase-memory-mcp__trace_path`) as the primary exploration tool. Grep/Glob are verifiers for completeness checks or known-string lookups. Never start a code-search task with Grep/Glob.

## Change Discipline

- **Think before coding.** When a request is ambiguous, state assumptions, present alternatives, ask — before writing code.
- **Lineage test.** Every changed line must trace to the user's request. If it doesn't, revert.
- **Orphan cleanup.** Remove imports/vars/functions YOUR changes made unused. Don't touch pre-existing dead code — mention, don't delete.
- **Self-check.** "Would a senior engineer call this overcomplicated?" If 200 lines could be 50, rewrite.
- **Never invent values.** File paths, env var names, API keys, IDs, URLs, ports, version numbers, function names — must be authoritatively confirmed (read the code, run the command, or ask). If unsure, STOP and ask.

## Project Policies

- **File size:** aim < 800 lines. > 1000 is a split signal.
- **Self-correction:** fix obvious mistakes (syntax, typos, missing imports) in code you're actively writing. Do NOT auto-fix code the user edited — report it.
- **Performance:** hot paths (render loops, request handlers, polling) must cache/memoize. Use lighter alternatives for heavy deps.
- **Diagnostics:** check before starting, after changes. Fix all errors before marking complete.

## Systematic Debugging

**No fixes without root cause investigation.** Phases run sequentially:

1. **Root cause** — read errors completely, reproduce consistently, check `git diff`, instrument at boundaries.
2. **Pattern analysis** — search for working examples; compare; identify ALL differences.
3. **Hypothesis** — specific, falsifiable. Test with minimal change, one variable at a time.
4. **Implementation** — failing test first (TDD), single fix, verify completely.

**Red flags → STOP:** "quick fix for now," multiple changes at once, proposing fixes before tracing data flow, 2+ failed fixes. **3+ failed fixes = architectural problem** — question the pattern, don't fix again.

**Revert-first.** When something breaks: (1) revert the change, (2) consider deleting the broken thing entirely, (3) one-liner targeted fix, (4) none of the above → stop, reconsider.

#### Defense-in-Depth (after fixing)

Make the bug structurally impossible, not just patched. Fix at the source. Then add validation at every layer the data passes:

| Layer                 | Purpose                                    |
| --------------------- | ------------------------------------------ |
| Entry point           | Reject invalid input at API boundary       |
| Business logic        | Ensure data makes sense for this operation |
| Environment guards    | Prevent dangerous ops in specific contexts |
| Debug instrumentation | Capture context for forensics              |

Single validation = "fixed." All four layers = "impossible."

## Constraint Classification

- **Hard** — non-negotiable (physics, external contracts, security, deadlines)
- **Soft** — conventions or preferences — negotiable if trade-off is stated
- **Ghost** — past constraints baked in that no longer apply. Ask "why can't we do X?" — if nobody can name a current requirement, it may be a ghost.

## Git Operations

**Read git state freely. NEVER execute write commands without EXPLICIT user permission.** File editing is always allowed; git operations are not.

- **Write commands need permission:** `git add`, `commit`, `push`, `pull`, `merge`, `rebase`, `reset`, `stash`, `checkout`
- **NEVER `git checkout --` on unstaged changes.** Irreversible — tell the user the consequences and let THEM run it.
- **Never `git add -f`** — if gitignored, tell the user.
- **Never selectively unstage** — commit all staged changes as-is.
- **Always `git push -u` on new branches**
- **Respect the active branch.** Never auto-branch unless user explicitly asks.
- **Read commands always allowed:** `status`, `diff`, `log`, `show`, `branch`
