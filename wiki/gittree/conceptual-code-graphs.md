# Conceptual Code Graphs (Program Analysis)

Static analysis and cybersecurity tools represent code relationships as graphs to map out control paths, dependencies, and execution sequences.

## Overview

Conceptual code graphs are intermediate representations used by compilers, linters, static analyzers, and security scanners. They transform source code into structured, analyzable forms that reveal hidden relationships and potential issues.

## Core Representations

### Abstract Syntax Trees (ASTs)

**Definition:** Hierarchical, syntactic representation of source code structure

**Purpose:**

- Represent the grammatical structure of code
- Enable parsers and compilers to understand code
- Foundation for all other program analysis tools

**Structure:**

```
AST Example: `const x = 5 + 3;`

        Assignment
        /        \
     Var        BinaryOp
      |          /      \
      x         +        \
               / \      Literal
            Literal  5     3
```

**Applications:**

- Code formatting (Prettier)
- Linting (ESLint)
- Refactoring tools (TypeScript Language Server)
- Code generation
- Syntax validation

**Tools Using ASTs:**

- Babel (JavaScript transpilation)
- TypeScript (type checking via AST)
- ESLint (code quality rules)
- GraphQL (schema parsing)

### Control-Flow Graphs (CFGs)

**Definition:** Maps all possible execution paths a program can take during runtime

**Purpose:**

- Identify unreachable code
- Detect infinite loops
- Understand branch coverage
- Analyze code complexity
- Debug execution flow

**Structure:**

```
CFG Example: if-else statement

         Entry
          |
       Condition
        /      \
      Yes       No
      /          \
   Block_A    Block_B
      \          /
       \        /
        Exit
```

**Applications:**

- Branch coverage analysis
- Dead code detection
- Loop analysis
- Data flow analysis
- Security vulnerability detection (e.g., unreachable exception handlers)

**Complexity Metrics:**

- Cyclomatic complexity (number of independent paths)
- Every decision point increases complexity
- High complexity = harder to test

### Call Graphs

**Definition:** Shows calling relationships between functions/methods

**Purpose:**

- Trace execution paths
- Identify performance bottlenecks
- Detect unused code
- Understand module dependencies
- Analyze memory leaks

**Structure:**

```
Call Graph Example:

       main()
       /    \
    init()  process()
      |       /  |  \
   setup()  read() write() validate()
      |       |      |
   connect() fetch() store()
```

**Applications:**

- Function dependency analysis
- Finding deeply nested call stacks (performance bottleneck)
- Identifying circular dependencies
- Test coverage planning
- API surface analysis

**Usage in Arch-Mk2:**

- Trace agent orchestrator execution paths
- Analyze MCP workflow calls
- Identify hot paths in N8N integration
- Map component rendering chains (React)

### Code Property Graphs (CPGs)

**Definition:** Unified representation merging ASTs, CFGs, and dependency graphs

**Purpose:**

- Advanced code analysis combining multiple representations
- Security vulnerability detection
- Architectural pattern identification
- Cross-cutting concern analysis

**Components:**

```
CPG = AST + CFG + Dependency Graph + Data Flow Graph

Enables queries like:
- "Find all user inputs that reach SQL queries"
- "Trace secrets from config to output"
- "Identify authentication bypass paths"
```

**Applications:**

- Security scanning (OWASP vulnerabilities)
- Architectural analysis
- Impact analysis (which files affected by a change?)
- Compliance checking (e.g., data handling)

**Tools:**

- Joern (program analysis platform)
- Semgrep (semantic code search)
- Snyk (vulnerability detection)
- CodeQL (GitHub security scanning)

## Practical Analysis Examples

### Example 1: Finding Performance Bottlenecks

Using call graphs and CFG:

```
Query: "Functions called >100 times per request?"

Result:
  main()
    → apiHandler() [1 call]
      → middleware() [1 call]
        → queryDatabase() [100+ calls]  ← BOTTLENECK

Solution: Cache results, optimize query, batch operations
```

### Example 2: Dead Code Detection

Using CFG:

```
Query: "Unreachable code paths?"

Result:
  if (DEBUG) {
    logVerbose();
    return;
  }
  unreachableCode(); ← Never executed if DEBUG = false
```

### Example 3: Security Vulnerability Detection

Using CPG:

```
Query: "User input flowing to SQL without sanitization?"

Trace:
  req.params.userId
    → queryBuilder.where(userId)  ← No sanitization!
      → database.query()           ← Vulnerable to SQL injection

Alert: Add input validation middleware
```

## Current Project Applications

### For Arch-Mk2

**AST Usage:**

- ESLint configuration for code quality rules
- Babel/TypeScript transformations
- Component structure analysis in React 19

**CFG Usage:**

- Identify complex agent orchestration paths
- Test coverage for agentic loop logic
- Branch coverage in workflow engine

**Call Graphs:**

- N8N workflow step sequencing
- MCP handler invocations
- Agent function calling patterns
- React component render chains

**CPG Potential:**

- Security audit of Supabase RLS policies
- Data flow analysis from auth → storage
- Service isolation verification

## Analysis Tools Available

### Built-in JavaScript/TypeScript

- **TypeScript Language Server** — AST-based type checking
- **ESLint** — AST-based linting
- **Babel** — AST transformations

### Semantic Analysis

- **Semgrep** — Pattern-based code search (all languages)
- **CodeQL** — Graph-based queries
- **codebase-memory-mcp** — Custom knowledge graph for this project

### Integration with Arch-Mk2

The `codebase-memory-mcp` tool already implements:

- Custom knowledge graph building
- Call graph extraction
- Cross-service analysis (HTTP calls, async calls)
- Data flow tracing

## Best Practices

1. **Complexity Limits** — Keep cyclomatic complexity < 10 per function
2. **Test Branch Coverage** — Aim for 80%+ coverage using CFG analysis
3. **Regular Audits** — Run static analysis on CI/CD (ESLint, type-check, security)
4. **Dependency Review** — Use call graphs to prevent circular imports
5. **Performance Analysis** — Identify hot paths with call graph profiling

## See Also

- [Graph Data Structures](./graph-data-structures.md) — Mathematical models & algorithms
- [Visual Graphs for Reporting](./visual-graphs-reporting.md) — Communicating analysis results
- [Git Tree History](./README.md) — Project structure and phases
