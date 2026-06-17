# Documentation Index

Quick navigation guide for Arch-Systems documentation.

## 🚀 Getting Started

### New to the Project?

- **[README.md](./README.md)** - Project overview and quick start (5 min read)
- **[CLAUDE.md](CLAUDE.md)** - Complete technical guide (30 min read)
- **[docs/wiki/concepts/project-overview.md](./wiki/concepts/project-overview.md)** - Project Overview & Tech Stack (Deep architectural & stack breakdown)

### Quick Reference

- **[docs/reports/PROJECT_AUDIT_UPGRADE_PLAN.md](./reports/PROJECT_AUDIT_UPGRADE_PLAN.md)** - Full-stack project audit, remote caching optimizations, and upgrade roadmap
- **[docs/wiki/index.md](./wiki/index.md)** - Project Wiki Index (Comprehensive catalog of 63 pages across concepts, comparisons, and entities)
- **[AGENTS.md](AGENTS.md)** - Workflow rules, quality gates, and quick commands
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide for all environments

## 🛠️ Development

### Core Development

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive technical guide covering:
  - Runtime requirements (Node.js ≥22, pnpm 9.15.9)
  - All development commands
  - Architecture (apps, packages, dependency versioning)
  - Portal internals (middleware, directories, instrumentation)
  - Git & quality infrastructure

### Workflow & Quality

- **[AGENTS.md](AGENTS.md)** - Development workflow and agent contracts
  - Phase boundaries (Discuss, Plan, Execute, Verify, Ship)
  - Quality gates and verification steps
  - Subagent discipline
  - Git safety rules

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

- **[scripts/ROCKY_LINUX_COMPATIBILITY.md](./scripts/ROCKY_LINUX_COMPATIBILITY.md)** - Rocky Linux/RHEL compatibility guide
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
├── docs/
│   ├── archive/                       # Historical checklists, phase plans, and reports
│   │   ├── LIQUID_GLASS_CHECKLIST.md
│   │   ├── PHASE3_MUI_BASE_MIGRATION.md
│   │   └── SECURITY_USABILITY_REPORT.md
│   ├── operations/                    # Control room procedures, FUXA integrations, and runbooks
│   │   ├── alert-response-procedures.md
│   │   ├── caching-strategy.md
│   │   ├── fuxa-integration-plan.md
│   │   └── runbooks/
│   │       ├── AMCA-RUNBOOK.md
│   │       └── auth-unavailable.md
│   ├── reports/                       # Project audits and upgrade plans
│   │   ├── PROJECT_AUDIT_UPGRADE_PLAN.md
│   │   └── architecture_walkthrough.md
│   └── wiki/                          # Detailed technical wiki and domain concept docs
│       ├── index.md                   # Wiki Index page
│       └── concepts/
│           ├── project-overview.md    # Comprehensive system architecture & stack guide
│           └── overview.md            # Wiki system introduction
└── scripts/
    └── ROCKY_LINUX_COMPATIBILITY.md   # Rocky Linux/RHEL compatibility guide
```

## 🔍 Quick Lookup

### I need to

- **Understand the system architecture & stack**: Read [docs/wiki/concepts/project-overview.md](./docs/wiki/concepts/project-overview.md)
- **Browse the complete developer wiki**: Check [docs/wiki/index.md](./docs/wiki/index.md)
- **Set up the project**: Start with [README.md](../README.md), then [CLAUDE.md](CLAUDE.md)
- **Understand the architecture**: Read [CLAUDE.md](CLAUDE.md) Architecture section
- **Run development commands**: Check [AGENTS.md](AGENTS.md) Commands section
- **Deploy the application**: Follow [DEPLOYMENT.md](../DEPLOYMENT.md) or run `./scripts/setup-production-environment.sh`
- **Deploy on Rocky Linux/RHEL**: Read [scripts/ROCKY_LINUX_COMPATIBILITY.md](../scripts/ROCKY_LINUX_COMPATIBILITY.md)
- **Design a new component**: Reference [DESIGN.md](../DESIGN.md) and [PRODUCT.md](../PRODUCT.md)
- **Implement AI features**: Read [GEMINI.md](../GEMINI.md)
- **Report a security issue**: Follow [SECURITY.md](../SECURITY.md)
- **Understand quality gates**: Review [AGENTS.md](AGENTS.md) Quality Gates section
- **Review historical plans / checklist**: Check [docs/archive/LIQUID_GLASS_CHECKLIST.md](./docs/archive/LIQUID_GLASS_CHECKLIST.md)
- **Find operational runbooks**: Check [docs/operations/runbooks/](./docs/operations/runbooks/)

## 📝 Documentation Maintenance

- Keep documentation updated with code changes
- Update this index when adding new documentation files
- Ensure cross-references between documents are maintained
- Review documentation relevance quarterly

---

**Last Updated**: 2026-06-15  
**Maintained by**: Arch-Systems Development Team
