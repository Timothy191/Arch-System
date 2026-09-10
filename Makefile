# ==============================================================================
# Arch-Systems Monorepo — Master Makefile & Project Outline
# ==============================================================================
# Compatible with VS Code Project Outline extension, Make task runners, and CLI.
# Run 'make help' or 'make outline' for a categorized overview.
# ==============================================================================

.DEFAULT_GOAL := help
.PHONY: help outline info onboard maps-gen \
        install dev dev-quick dev-tools dev-all dev-turbo dev-cloudflare dev-hosted inngest-dev \
        build analyze bundlesize sync-assets \
        test test-e2e test-watch test-coverage test-unit pentest \
        quality lint lint-fix lint-root lint-styles lint-spelling type-check format format-check md-lint md-fix html-check \
        audit-suite audit-compliance audit-design audit-tokens audit-drift audit-rls audit-rls-matrix audit-agents audit-explain circular-dep secrets-rotate \
        mcp-sync mcp-validate tags-apply \
        db-start db-push db-gen db-reset db-seed db-backup db-restore db-docs \
        monitor monitor-grafana monitor-stop monitor-bundle watchdog \
        deploy-local deploy-cloudflare deploy-staging deploy-production deploy-rollback deploy-dashboards deploy-dashboards-stop fresh-start shutdown \
        clean clean-cache clean-docker hooks-install deps-check deps-fix deps-lint knip knip-fix ui workspace-list workspace-graph

# ==============================================================================
# 1. Project & Workspace Outline
# ==============================================================================

help: ## Show this interactive help menu and target outline
	@echo ''
	@echo ' Arch-Systems — Monorepo Project Outline & Command Hub'
	@echo ' ======================================================'
	@echo ' Usage: make [target]'
	@echo ''
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ''

outline: ## Print visual overview of projects, apps, and packages in workspace
	@echo 'Arch-Systems Project Architecture Outline'
	@echo '========================================='
	@echo 'Apps:'
	@echo '  • apps/portal           - Main operational mining portal (Next.js 16 App Router)'
	@echo '  • apps/aria-overlay     - Real-time accessibility and assistive HUD layer'
	@echo ''
	@echo 'Packages & Shared Libs:'
	@echo '  • packages/database     - PostgreSQL schema migrations, RLS policies, and types'
	@echo '  • packages/supabase     - Supabase client wrappers and read replica connectors'
	@echo '  • packages/ui           - Core reusable UI component library'
	@echo '  • packages/theme        - Style Dictionary & design tokens'
	@echo '  • packages/redis        - Distributed cache client and rate limiting'
	@echo '  • packages/utils        - Shared helpers and Inngest job client'
	@echo '  • packages/logger       - Structured JSON / Pino logging'
	@echo '  • packages/errors       - Domain error models and handling'
	@echo '  • packages/eval         - DeepEval evaluation framework'
	@echo '  • services/integrations - Native LLM & API clients (OpenRouter, Cohere)'
	@echo ''
	@echo 'Node.js: $(shell node --version 2>/dev/null || echo "Not detected")'
	@echo 'pnpm:    $(shell pnpm --version 2>/dev/null || echo "Not detected")'
	@echo 'Root:    $(shell pwd)'

info: ## Show environment, tool versions, and system information
	@echo 'System & Environment Profile'
	@echo '============================'
	@echo 'Node.js:           $(shell node --version 2>/dev/null || echo "N/A")'
	@echo 'pnpm:              $(shell pnpm --version 2>/dev/null || echo "N/A")'
	@echo 'Turbo:             $(shell pnpm turbo --version 2>/dev/null || echo "N/A")'
	@echo 'Working directory: $(shell pwd)'

onboard: ## Run the interactive monorepo onboarding diagnostic CLI
	pnpm onboard

maps-gen: ## Regenerate codebase architecture and dependency maps
	pnpm maps:gen

workspace-list: ## List all monorepo workspace packages
	pnpm --filter "*" exec pwd

workspace-graph: ## Display the workspace dependency graph
	pnpm --graph

# ==============================================================================
# 2. Development & Local Servers
# ==============================================================================

install: ## Install all workspace dependencies via pnpm
	pnpm install

dev: ## Start full development environment (Portal + Supabase + MCP + Sync)
	pnpm dev

dev-quick: ## Start fast development server (headless, skips Docker/Supabase)
	pnpm dev:quick

dev-tools: ## Start development server with tools stack (Redis, Flowise, etc.)
	pnpm dev -- -t

dev-all: ## Start development server with all apps and packages
	pnpm dev:all:turbo

dev-turbo: ## Start Next.js portal application directly via Turbo
	pnpm dev:turbo

dev-cloudflare: ## Start dev stack bound for Cloudflare Tunnel network access
	pnpm dev:cloudflare

dev-hosted: ## Start dev stack against hosted cloud backend
	pnpm dev:hosted

inngest-dev: ## Start the Inngest local development server and dashboard
	pnpm inngest:dev

# ==============================================================================
# 3. Building & Bundle Optimization
# ==============================================================================

build: ## Build all packages and applications in monorepo
	pnpm build

analyze: ## Analyze Next.js bundle sizes and report chunk weights
	pnpm analyze

bundlesize: ## Check production bundle sizes against defined budgets
	pnpm bundlesize

sync-assets: ## Synchronize design tokens, static assets, and configurations
	node scripts/sync-assets-smart.cjs

# ==============================================================================
# 4. Testing & Validation
# ==============================================================================

test: ## Run unit tests across the entire monorepo
	pnpm test

test-unit: ## Run portal unit tests with Jest
	pnpm --filter portal test

test-e2e: ## Run end-to-end tests with Playwright (requires active dev server)
	pnpm test:e2e

test-watch: ## Run portal tests in interactive watch mode
	pnpm --filter portal test -- --watch

test-coverage: ## Run portal tests with coverage reporting
	pnpm --filter portal test -- --coverage

pentest: ## Run automated security penetration tests
	bash scripts/pentest.sh

# ==============================================================================
# 5. Quality, Linting & Formatting
# ==============================================================================

check-fast: ## Ultra-fast workspace linting & formatting check with Biome (<500ms)
	pnpm check:fast

check-fast-fix: ## Ultra-fast automatic workspace formatting & lint fix with Biome
	pnpm check:fast:fix

lint-fast: ## Ultra-fast AST linting across workspace with Biome
	pnpm lint:fast

format-fast: ## Ultra-fast codebase formatting with Biome
	pnpm format:fast

quality: ## Run complete quality gate (lint, type-check, test, format, audit)
	pnpm quality

lint: ## Run ESLint across all projects in workspace
	pnpm lint

lint-fix: ## Automatically fix ESLint violations across workspace
	pnpm lint --fix

lint-root: ## Lint root directory configuration files only
	pnpm lint:root

lint-styles: ## Lint CSS and design stylesheets with Stylelint
	pnpm lint:styles

lint-spelling: ## Check spelling across codebase with CSpell
	pnpm lint:spelling

type-check: ## Run TypeScript type-checking across all projects
	pnpm type-check

format: ## Format code across workspace with Prettier
	pnpm format

format-check: ## Check formatting compliance without writing files
	pnpm format:check

md-lint: ## Lint markdown documentation
	pnpm md:lint

md-fix: ## Fix markdown formatting and lint issues
	pnpm md:fix

html-check: ## Validate HTML structure and meta tags
	pnpm html:check

# ==============================================================================
# 6. Audits & Security Compliance
# ==============================================================================

audit-suite: ## Run the comprehensive automated audit suite
	pnpm audit:suite

audit-compliance: ## Run full compliance checks (tokens, drift, RLS, agents, migrations)
	pnpm audit:compliance

audit-design: ## Audit design system consistency and token usages
	pnpm audit:design

audit-tokens: ## Audit design token coverage and detect hardcoded values
	pnpm audit:tokens

audit-drift: ## Audit contract schema drift between database and TypeScript models
	pnpm audit:drift

audit-rls: ## Audit PostgreSQL Row Level Security policies
	pnpm audit:rls

audit-rls-matrix: ## Generate and verify department RLS permission access matrix
	pnpm audit:rls-matrix

audit-agents: ## Audit agent definitions, prompts, and tool contracts
	pnpm audit:agents

audit-explain: ## Analyze database query execution plans and index utilization
	pnpm audit:explain

circular-dep: ## Detect circular dependencies across packages
	node tools/audits/circular-dep-detect.cjs

secrets-rotate: ## Rotate application and service secrets
	node tools/ops/rotate-secrets.mjs

# ==============================================================================
# 7. Model Context Protocol (MCP) & Tags
# ==============================================================================

mcp-sync: ## Generate and synchronize user-specific MCP configurations
	node scripts/sync-mcp-config.js

mcp-validate: ## Validate connectivity and tool readiness of MCP servers
	node scripts/validate-mcp-servers.js

# ==============================================================================
# 8. Database & Supabase Operations
# ==============================================================================

db-start: ## Start local Supabase development container stack
	pnpm --filter @repo/database supabase:dev

db-push: ## Apply database migrations to local Supabase instance
	pnpm --filter @repo/database supabase:push

db-gen: ## Generate TypeScript types from Supabase database schema
	pnpm --filter @repo/database supabase:gen

db-reset: ## Reset local Supabase database to clean state (destructive)
	pnpm --filter @repo/database supabase:reset

db-seed: ## Seed database with mock operational test data
	pnpm db:seed

db-backup: ## Create a snapshot backup of the current database
	bash scripts/backup-db.sh

db-restore: ## Restore database from a previous snapshot
	bash scripts/restore-db.sh

db-docs: ## Generate database schema documentation and markdown charts
	pnpm db:docs

# ==============================================================================
# 9. Monitoring & Observability
# ==============================================================================

monitor: ## Launch interactive CLI monitoring HUD dashboard
	pnpm monitor

monitor-grafana: ## Start Prometheus and Grafana monitoring stack
	pnpm monitor:grafana

monitor-stop: ## Stop Grafana and Prometheus monitoring stack
	pnpm monitor:grafana-stop

monitor-bundle: ## Start bundle size change tracker
	pnpm monitor:bundle

watchdog: ## Launch background system health watchdog
	bash scripts/watchdog.sh

# ==============================================================================
# 10. Deployment & Infrastructure
# ==============================================================================

deploy-local: ## Deploy stack to local environment
	pnpm deploy:local

deploy-cloudflare: ## Deploy and expose stack over Cloudflare Tunnel edge network
	pnpm deploy:cloudflare

deploy-staging: ## Deploy stack to staging environment
	pnpm deploy:staging

deploy-production: ## Deploy stack to production environment
	pnpm deploy:production

deploy-rollback: ## Rollback last production deployment
	pnpm deploy:rollback

deploy-dashboards: ## Start Glance and Dashy sidecar dashboards
	docker compose -f infra/docker/compose.dashboards.yml up -d

deploy-dashboards-stop: ## Stop Glance and Dashy sidecar dashboards
	docker compose -f infra/docker/compose.dashboards.yml down

fresh-start: ## Clean rebuild and fresh start of local stack
	pnpm fresh-start

shutdown: ## Gracefully stop and shutdown all running services
	pnpm shutdown

# ==============================================================================
# 11. Dependencies, UI & Clean Up
# ==============================================================================

deps-check: ## List dependency version mismatches across packages
	pnpm deps:check

deps-fix: ## Automatically fix dependency version mismatches
	pnpm deps:fix

deps-lint: ## Check dependency version consistency
	pnpm deps:lint

knip: ## Scan for unused files, exports, and dependencies
	pnpm knip

knip-fix: ## Automatically remove unused dependencies and exports
	pnpm knip:fix

ui: ## Open shadcn/ui component CLI
	pnpm ui

hooks-install: ## Install and configure Git lifecycle hooks
	pnpm prepare

clean: ## Clean build artifacts, temporary caches, and node_modules
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/.next
	rm -rf .turbo
	rm -rf .next
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

clean-cache: ## Clean Turbo and compiler caches only
	rm -rf .turbo
	rm -rf apps/*/.next/cache

clean-docker: ## Stop and remove all Docker containers, networks, and volumes
	docker compose -f infra/docker/compose.tools.yml down -v 2>/dev/null || true
	docker compose -f infra/monitoring/docker-compose.yml down -v 2>/dev/null || true
	docker compose -f infra/docker/compose.redis.yml down -v 2>/dev/null || true
	docker compose -f infra/docker/compose.production.yml down -v 2>/dev/null || true
