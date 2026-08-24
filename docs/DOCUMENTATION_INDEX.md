# Documentation Index

Quick navigation guide for Arch-Systems documentation.

## 🚀 Getting Started

### New to the Project?

- **[docs/ONBOARDING.md](./ONBOARDING.md)** - Step-by-step developer onboarding checklist
- **[README.md](../README.md)** - Project overview and quick start (5 min read)
- **[CLAUDE.md](../CLAUDE.md)** - Authoritative technical guide: commands, architecture, conventions, codegen (~2 min read)
- **[docs/wiki/concepts/project-overview.md](./wiki/concepts/project-overview.md)** - Project Overview & Tech Stack (Deep architectural & stack breakdown)

### Quick Reference

- **[docs/reports/PROJECT_AUDIT_UPGRADE_PLAN.md](./reports/PROJECT_AUDIT_UPGRADE_PLAN.md)** - Full-stack project audit, remote caching optimizations, and upgrade roadmap
- **[docs/wiki/index.md](./wiki/index.md)** - Project Wiki Index (Comprehensive catalog of 63 pages across concepts, comparisons, and entities)
- **[AGENTS.md](AGENTS.md)** - Workflow rules, quality gates, and quick commands
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide for all environments

## 🛠️ Development

### Core Development

- **[CLAUDE.md](../CLAUDE.md)** - Authoritative technical guide (commands, tracing, conventions)

### Workflow & Quality

- **[AGENTS.md](AGENTS.md)** - Slim agent contract index (tracing, phases, Nx tags; links to rules)

### Architecture & Visualization

- **[codebase-maps/README.md](../documentation/04-codebase-maps/README.md)** - Codebase visualization maps
  - Project dependencies map with dependency graphs
  - Package structure overview
  - Route/feature architecture mapping
  - Database schema documentation with ER diagrams
  - Technology stack overview
  - CI/CD pipeline visualization
  - All maps include Mermaid diagrams for visual representation

### Audit & Quality Reports

- **[documentation/03-audit-reports/](../documentation/03-audit-reports/)** - Unified audit reports
  - RLS (Row Level Security) audit reports
  - Design system compliance reports
  - Required action items and remediation plans
  - Versioned audit logs with historical tracking
  - Latest audit results for immediate review

### AI Development

- **[GEMINI.md](./GEMINI.md)** - AI-specific development conventions
  - Data safety & confirmation requirements
  - Production readiness & recovery
  - Systematic debugging approach
  - Subdirectory instructions

## 🎨 Design & Product

### Design System

- **[DESIGN.md](./DESIGN.md)** - Complete design system reference
  - Color system (OKLCH palette)
  - Typography scale and rules
  - Elevation & shadows
  - Component rules
  - Animation constraints
  - Responsive breakpoints

### Product Strategy

- **[PRODUCT.md](./PRODUCT.md)** - Product strategy and user personas
  - User personas (Control Room Operators, Engineering Staff, Safety Officers, etc.)
  - Product tone and anti-references
  - Surface mapping
  - Design strategy

### UI Implementation

- **[LIQUID_GLASS_CHECKLIST.md](./archive/LIQUID_GLASS_CHECKLIST.md)** - UI implementation checklist
  - Phased implementation guide for liquid glass interface
  - WebGL refraction and shader requirements
  - Accessibility and responsiveness requirements

## 🔒 Security & Deployment

### Security

- **[SECURITY.md](./SECURITY.md)** - Security policy and vulnerability reporting
  - Supported versions
  - Security practices
  - Vulnerability reporting process

### Deployment

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Comprehensive deployment guide
  - Quick start for local, staging, and production
  - **Automated production setup via `scripts/setup-production-environment.sh`**
  - Docker deployment
  - CI/CD with GitHub Actions
  - Troubleshooting and best practices

- **[ROCKY_LINUX_COMPATIBILITY.md](./ROCKY_LINUX_COMPATIBILITY.md)** - Rocky Linux/RHEL compatibility guide
  - Platform-specific prerequisites and setup instructions
  - Firewall (firewalld) configuration
  - SELinux considerations and policies
  - Troubleshooting for Rocky Linux environments

## 📊 Documentation Structure

```text
Arch-Mk2/
├── README.md                          # Project overview
├── CLAUDE.md                          # Technical guide (authoritative)
├── AGENTS.md                          # Workflow rules
├── DEPLOYMENT.md                      # Deployment guide
├── DESIGN.md                          # Design system reference
├── PRODUCT.md                         # Product strategy
├── GEMINI.md                          # AI conventions
├── SECURITY.md                        # Security policy
├── DOCUMENTATION_INDEX.md             # This file
├── documentation/                     # Unified documentation center
│   ├── README.md                      # Documentation center index
│   ├── 00-core/                       # Core project documentation
│   ├── 01-operations/                 # Operational procedures and runbooks
│   ├── 02-system-wiki/                # System knowledge base
│   ├── 03-audit-reports/              # Audit reports and RLS analysis
│   ├── 04-codebase-maps/              # Codebase visualization and maps
│   ├── 05-wiki/                       # Comprehensive technical wiki
│   ├── 06-archives/                   # Historical documentation
│   ├── 07-agentic-systems/            # Agentic system documentation
│   ├── 08-guides/                     # Operational guides and handbooks
│   ├── 09-tools/                     # Documentation tools and generators
│   └── 10-references/                 # Reference materials
├── docs/                              # Legacy documentation (migrating to documentation/)
│   ├── archive/                       # Historical checklists, phase plans, and reports
│   ├── operations/                    # Control room procedures, FUXA integrations, and runbooks
│   ├── reports/                       # Project audits and upgrade plans
│   └── wiki/                          # Detailed technical wiki and domain concept docs
└── scripts/
    └── ROCKY_LINUX_COMPATIBILITY.md   # Rocky Linux/RHEL compatibility guide
```

## 🔍 Quick Lookup

### I need to

- **Understand the system architecture & stack**: Read [docs/wiki/concepts/project-overview.md](./docs/wiki/concepts/project-overview.md)
- **Browse the complete developer wiki**: Check [docs/wiki/index.md](./docs/wiki/index.md)
- **Visualize the codebase structure**: Explore [codebase-maps/README.md](../documentation/04-codebase-maps/README.md) for dependency graphs, architecture diagrams, and visual maps
- **Review audit reports and quality status**: Check [documentation/03-audit-reports/](../documentation/03-audit-reports/) for RLS and design compliance reports
- **Set up the project**: Start with [README.md](../README.md), then [CLAUDE.md](CLAUDE.md)
- **Understand the architecture**: Read [CLAUDE.md](CLAUDE.md) Architecture section or view [codebase-maps](../documentation/04-codebase-maps/)
- **Run development commands**: Check [AGENTS.md](AGENTS.md) Commands section
- **Deploy the application**: Follow [DEPLOYMENT.md](../DEPLOYMENT.md) or run `./scripts/setup-production-environment.sh`
- **Deploy on Rocky Linux/RHEL**: Read [ROCKY_LINUX_COMPATIBILITY.md](./ROCKY_LINUX_COMPATIBILITY.md)
- **Design a new component**: Reference [DESIGN.md](../DESIGN.md) and [PRODUCT.md](../PRODUCT.md)
- **Implement AI features**: Read [GEMINI.md](../GEMINI.md)
- **Report a security issue**: Follow [SECURITY.md](../SECURITY.md)
- **Understand quality gates**: Review [AGENTS.md](AGENTS.md) Quality Gates section
- **Review historical plans / checklist**: Check [docs/archive/LIQUID_GLASS_CHECKLIST.md](./docs/archive/LIQUID_GLASS_CHECKLIST.md)
- **Find operational runbooks**: Check [docs/operations/runbooks/](./docs/operations/runbooks/)
- **Explore unified documentation**: Visit [documentation/README.md](../documentation/README.md) for the new documentation center structure

## 📝 Documentation Maintenance

- Keep documentation updated with code changes
- Update this index when adding new documentation files
- Ensure cross-references between documents are maintained
- Review documentation relevance quarterly
- **Migration in Progress**: Documentation is being consolidated into the unified `documentation/` directory structure
  - Phase 1 ✅: Core documentation structure created
  - Phase 2 ✅: Audit reports migrated to `documentation/03-audit-reports/`
  - Phase 3 ⏳: Codebase maps migration planned
  - Phase 4 ⏳: System wiki consolidation planned
  - Legacy `docs/` directory will remain during migration period

---

**Last Updated**: 2026-08-20  
**Maintained by**: Arch-Systems Development Team
