# Codebase Maps

**Generated:** 2026-08-18  
**System:** Arch-System Mining Operations Portal

## Overview

This directory contains comprehensive visual maps of the Arch-System Mining Operations Portal codebase. These maps provide various perspectives on the system architecture, dependencies, and structure to help developers understand the codebase quickly.

## Available Maps

### 1. Project Dependencies Map

**File:** `project-dependencies_26-08-18.md`

Visualizes the dependency relationships between all projects in the Nx monorepo workspace.

**Contents:**

- Project type distribution (Applications, Feature Libraries, Shared Libraries, Repository Packages, Utility Projects)
- Dependency count by project type
- High-level dependency flow
- Detailed dependency graph for each project
- External dependencies analysis

**Use when:** Understanding how projects depend on each other, planning dependency changes, or analyzing circular dependencies.

### 2. Package Structure Map

**File:** `package-structure_26-08-18.md`

Documents the monorepo package structure and organization.

**Contents:**

- Workspace organization overview
- Application packages structure
- Feature library organization
- Shared library dependencies
- Repository package structure
- Package size and complexity metrics

**Use when:** Understanding the monorepo layout, planning new packages, or navigating the codebase structure.

### 3. Route/Feature Architecture Map

**File:** `route-feature-architecture_26-08-18.md`

Maps the Next.js routing structure to feature implementations.

**Contents:**

- Route hierarchy and organization
- Feature-to-route mapping
- Authentication flow
- Department-specific routes
- API route structure
- Page component organization

**Use when:** Understanding how features are organized across routes, planning new features, or navigating the application structure.

### 4. Database Schema Map

**File:** `database-schema_26-08-18.md`

Documents the Supabase database schema and relationships.

**Contents:**

- Table relationships and foreign keys
- Row Level Security (RLS) policies
- Database constraints and indexes
- Entity relationship diagrams
- Table-by-table documentation

**Use when:** Understanding the data model, planning database changes, or writing data-access code.

### 5. Technology Stack Map

**File:** `technology-stack_26-08-18.md`

Comprehensive overview of technologies used across the system.

**Contents:**

- Frontend technologies (Next.js, React, TypeScript)
- Backend technologies (Supabase, Payload CMS)
- Development tools (Nx, pnpm, ESLint)
- Deployment infrastructure (Cloudflare, Docker)
- Security and monitoring tools
- Technology adoption trends

**Use when:** Understanding the technology choices, planning upgrades, or onboarding new developers.

### 6. CI/CD Pipeline Map

**File:** `ci-cd-pipeline_26-08-18.md`

Documents the continuous integration and deployment workflows.

**Contents:**

- GitHub Actions workflow structure
- CI pipeline stages (lint, type-check, test, build)
- Deployment workflows (staging, production, canary)
- Quality gates and automated checks
- Pipeline optimization strategies

**Use when:** Understanding the deployment process, debugging CI failures, or planning pipeline improvements.

## Visualization

Each map includes Mermaid diagrams for visual representation:

- **Pie charts** - Distribution and percentage breakdowns
- **Bar charts** - Comparisons and metrics
- **Flow diagrams** - Process flows and dependencies
- **Sequence diagrams** - Interaction patterns
- **Mind maps** - Hierarchical relationships
- **Graph diagrams** - Network structures and connections

These diagrams render in Markdown viewers that support Mermaid (GitHub, GitLab, VS Code with extensions, etc.).

## Regeneration

The maps are generated automatically using the `scripts/regenerate-codebase-maps.sh` script. This script:

1. Scans the current codebase structure
2. Analyzes dependencies, routes, database schema, and configuration
3. Generates updated markdown files with current information
4. Creates SVG images from Mermaid diagrams

To regenerate the maps:

```bash
# From the project root
./scripts/regenerate-codebase-maps.sh
```

**Note:** Ensure you have the Mermaid CLI installed (`npm install -g @mermaid-js/mermaid-cli`) for SVG generation.

## Versioning

Maps are named with the generation date in `YY-MM-DD` format (e.g., `project-dependencies_26-08-18.md`). This allows:

- Historical tracking of codebase evolution
- Comparison between different time periods
- Reference points for major architectural changes

## Integration with Documentation

These maps are referenced from the main documentation index at [`docs/DOCUMENTATION_INDEX.md`](../docs/DOCUMENTATION_INDEX.md). They serve as visual companions to the textual documentation.

## Maintenance

Maps should be regenerated:

- After major architectural changes
- When adding or removing significant features
- Before major releases
- After database schema migrations
- When updating the technology stack

## Contributing

When making changes that affect the codebase structure:

1. Run the regeneration script to update maps
2. Review the generated maps for accuracy
3. Commit the updated maps along with your changes
4. Reference the relevant maps in your commit message

## Troubleshooting

**Mermaid diagrams not rendering:**

- Ensure your Markdown viewer supports Mermaid
- For local viewing, use VS Code with the Markdown Preview Mermaid Support extension
- For web viewing, ensure the platform supports Mermaid (GitHub, GitLab do)

**SVG generation fails:**

- Install Mermaid CLI: `npm install -g @mermaid-js/mermaid-cli`
- Ensure you have Node.js >= 14 installed
- Check that the script has execute permissions

**Maps outdated:**

- Run the regeneration script
- Check git history for when maps were last updated
- Verify the script has access to all necessary project files

## Related Documentation

- [`docs/DOCUMENTATION_INDEX.md`](../docs/DOCUMENTATION_INDEX.md) - Main documentation navigation
- [`DESIGN.md`](../DESIGN.md) - System design documentation
- [`AGENTS.md`](../AGENTS.md) - Agent contract and guidelines
- [`DEPLOYMENT.md`](../docs/DEPLOYMENT.md) - Deployment procedures
