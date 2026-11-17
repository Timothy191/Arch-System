// Code Intelligence Integration for Arch-System
// Inspired by jcodemunch-mcp: tree-sitter based symbol search and context assembly
// Provides 90-99% token savings per code lookup

## Integration Status

This module integrates jcodemunch-mcp-inspired code intelligence capabilities into the Arch-System monorepo.

### Core Features

1. **Symbol Search** (`search_symbols`)
   - Tree-sitter AST based symbol retrieval
   - Exact symbol matches with byte-level precision
   - 96.2% fewer tokens per lookup vs. grep-and-read

2. **Ranked Context Assembly** (`get_ranked_context`)
   - Token-budgeted context extraction
   - Natural-language task → context capsule
   - Auto-classifies into six intents

3. **Edit Safety Preflight** (`check_edit_safe`)
   - Complexity analysis
   - Test coverage presence check
   - Runtime traffic verification
   - Import impact assessment

4. **Refactoring Plans** (`plan_refactoring`)
   - Rename, move, extract operations
   - Cyclomatic complexity analysis
   - Dependency graph impact

5. **PR Risk Profiling** (`get_pr_risk`)
   - Changed symbol analysis
   - Breaking change detection
   - Runtime hit mapping

### Integration Points

- **@repo/code-intelligence** package: `/packages/code-intelligence/`
- **MCP registry**: `/tools/mcp/mcp-registry.json`
- **Agent hooks**: `/libs/shared/hooks/src/`
- **Code index**: Built via `pnpm code-intelligence:index`

### Token Savings Estimate

Based on jcodemunch-mcp benchmarks:

- 96.2% average token reduction per lookup
- 10.4x to 132.5x per-query reduction
- For Arch-System (~4,500 files): potential savings of hundreds of thousands of tokens

### Getting Started

```bash
# 1. Install the code-intelligence package
pnpm --filter @repo/code-intelligence build

# 2. Index the codebase
pnpm code-intelligence:index

# 3. Search for symbols
pnpm code-intelligence:search <symbol-name>

# 4. Get ranked context for a task
pnpm code-intelligence:context "<task description>" <token-budget>
```
