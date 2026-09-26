# MCP Tool Integration Contracts

## 1. Tool Routing Architecture

Model Context Protocol (MCP) servers are registered in `.agents/mcp_config.json` and categorized into eagerly loaded and lazy loaded tools:

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT REASONING CORE                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│     EAGERLY LOADED TOOLS      │   │     LAZY LOADED TOOLS     │
│ - Native Workspace FS Tools   │   │ - Postgres MCP            │
│ - Shell & Process Execution   │   │ - Redis MCP               │
│ - Grep / Navigation Tools     │   │ - Chrome DevTools MCP     │
│ - Web Fetch & Search          │   │ - Codebase Memory MCP     │
└───────────────────────────────┘   └───────────────────────────┘
```

## 2. Server Registry

- **`postgres`**: Direct SQL inspection and transaction testing.
- **`redis`**: Cache key inspection, invalidation assertions, and latency benchmarking.
- **`chrome-devtools-mcp`**: Headless browser automation, visual regression screenshots, and Web Vitals trace analysis.
- **`codebase-memory`**: AST dependency graph tracing and cross-package symbol indexing.
- **`context7`**: Documentation query engine for runtime libraries.
- **`github`**: Repository synchronization, PR management, and issue automation.
