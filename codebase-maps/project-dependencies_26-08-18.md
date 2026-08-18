# Project Dependencies Map

**Generated:** 2026-08-18  
**System:** Arch-System Mining Operations Portal

## Overview

This map visualizes the dependency relationships between all projects in the Nx monorepo workspace.

## Applications (3)

### portal

- **Type:** Application (Next.js 15+)
- **Port:** 3000
- **Purpose:** Main mining operations portal
- **Dependencies:**
  - @repo/supabase (static)
  - @repo/ui (static, dynamic)
  - @repo/contract (static)
  - @repo/utils (static, dynamic)
  - features-departments-data-access (static)
  - features-departments-ui (static)
  - @repo/redis (static)
  - @repo/rate-limiter (static)
  - @repo/logger (static)
  - @repo/theme (static)
  - features-auth-ui (static)
  - features-hub-ui (static)
  - shared-data-access (static)
  - shared-utils (static)
  - @repo/typescript-config (static)
  - @repo/errors (static)

### cms

- **Type:** Application (Payload CMS v3)
- **Purpose:** Content management system
- **Dependencies:**
  - @repo/typescript-config (static)

### arch-systems-overview

- **Type:** Application
- **Purpose:** Overview dashboard
- **Dependencies:**
  - @repo/theme (static)

### n8n-mcp-server

- **Type:** Application
- **Purpose:** n8n MCP server integration
- **Dependencies:** None

## Feature Libraries (8)

### features-departments-data-access

- **Package:** @repo/departments/data-access
- **Scope:** departments, data-access, feature
- **Dependencies:** None

### features-analytics-data-access

- **Package:** @repo/analytics/data-access
- **Scope:** analytics, data-access, feature
- **Dependencies:** None

### features-dashboard-data-access

- **Package:** @repo/dashboard/data-access
- **Scope:** dashboard, data-access, feature
- **Dependencies:**
  - @repo/supabase (static)
  - @repo/redis (static)
  - @repo/errors (static)
  - @repo/logger (static)

### features-access-control-ui

- **Scope:** access-control, ui, feature
- **Dependencies:** None

### features-auth-data-access

- **Scope:** auth, data-access, feature
- **Dependencies:** None

### features-departments-ui

- **Scope:** departments, ui, feature
- **Dependencies:**
  - @repo/contract (static)
  - @repo/errors (static)
  - @repo/logger (static)
  - @repo/redis (static)
  - @repo/supabase (static)
  - @repo/ui (static)
  - @repo/utils (static, dynamic)
  - shared-hooks (static)
  - shared-data-access (static)

### features-auth-ui

- **Scope:** auth, ui, feature
- **Dependencies:**
  - @repo/ui (static)
  - features-auth-data-access (static)
  - features-auth-utils (static)

### features-auth-utils

- **Scope:** auth, utils, feature
- **Dependencies:** None

### features-hub-ui

- **Scope:** hub, ui, feature
- **Dependencies:**
  - @repo/ui (static)
  - features-departments-data-access (static)

## Shared Libraries (4)

### shared-data-access

- **Dependencies:**
  - @repo/supabase (static)
  - @repo/redis (static)
  - @repo/errors (static)

### shared-hooks

- **Dependencies:** None

### shared-styles

- **Dependencies:** None

### shared-utils

- **Dependencies:**
  - @repo/redis (static)
  - @repo/errors (static)

## Repository Packages (13)

### @repo/contract

- **Purpose:** Shared contracts and schemas
- **Dependencies:**
  - @repo/typescript-config (static)

### @repo/database

- **Purpose:** Database migrations and schema
- **Dependencies:** None

### @repo/supabase

- **Purpose:** Supabase client and utilities
- **Dependencies:** None

### @repo/ui

- **Purpose:** Shared UI components
- **Dependencies:**
  - @repo/typescript-config (static)
  - @repo/theme (static)

### @repo/theme

- **Purpose:** Design system and tokens
- **Dependencies:**
  - @repo/typescript-config (static)

### @repo/typescript-config

- **Purpose:** TypeScript configuration
- **Dependencies:** None

### @repo/eslint-config

- **Purpose:** ESLint configuration
- **Dependencies:** None

### @repo/logger

- **Purpose:** Logging utilities
- **Dependencies:**
  - @repo/typescript-config (static)

### @repo/errors

- **Purpose:** Error handling utilities
- **Dependencies:** None

### @repo/redis

- **Purpose:** Redis client and utilities
- **Dependencies:**
  - @repo/typescript-config (static)

### @repo/utils

- **Purpose:** General utilities
- **Dependencies:**
  - @repo/typescript-config (static)

### @repo/rate-limiter

- **Purpose:** Rate limiting utilities
- **Dependencies:**
  - @repo/typescript-config (static)

### @repo/agents

- **Purpose:** Agent-related utilities
- **Dependencies:**
  - @repo/typescript-config (static)

### @repo/eval

- **Purpose:** Evaluation utilities
- **Dependencies:** None

### @repo/cloudflare-workflows

- **Purpose:** Cloudflare Workflows integration
- **Dependencies:** None

## Utility Projects (1)

### scripts-seeds

- **Purpose:** Database seeding scripts
- **Dependencies:** None

## Dependency Patterns

### High-Level Dependency Hierarchy

```
Applications (portal, cms, overview)
├── Feature Libraries (departments, auth, analytics, dashboard)
│   ├── @repo/* packages
│   └── Shared Libraries
└── @repo/* packages
    └── Shared Libraries
```

### Critical Paths

1. **Portal** → depends on 15 packages (most complex)
2. **CMS** → minimal dependencies (TypeScript config only)
3. **Feature UI libraries** → depend on @repo/ui and corresponding data-access layers
4. **Data-access layers** → depend on @repo/supabase, @repo/redis, @repo/errors, @repo/logger

### Tag-Based Organization

- `scope:app` - Applications (portal, cms, arch-systems-overview, n8n-mcp-server)
- `scope:feature` - Feature libraries (8 libraries)
- `scope:package` - Repository packages (@repo/\*)
- `type:data-access` - Data access layers
- `type:ui` - UI components
- `npm:private` - All packages are private

### Static vs Dynamic Dependencies

- **Static:** Build-time dependencies (imports, requires)
- **Dynamic:** Runtime dependencies (dynamic imports, lazy loading)
- Portal has 2 dynamic dependencies (@repo/ui, @repo/utils)
- features-departments-ui has 1 dynamic dependency (@repo/utils)
