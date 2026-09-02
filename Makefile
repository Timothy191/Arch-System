.PHONY: help install dev dev-quick dev-tools dev-all build analyze test test-e2e test-watch test-coverage lint lint-fix lint-root type-check format format-check md-lint md-fix quality deps-lint deps-fix deps-check knip knip-fix db-gen db-push db-reset db-start db-docs monitor monitor-grafana monitor-stop deploy-local deploy-staging deploy-production deploy-rollback deploy-dashboards deploy-dashboards-stop fresh-start shutdown ui clean clean-cache clean-docker hooks-install policy-gen policy-check audit-rls workspace-list workspace-graph info

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development
install: ## Install dependencies
	pnpm install

dev: ## Start development server (full stack with Supabase)
	pnpm dev

dev-quick: ## Start development server (quick mode, skip Docker/Supabase)
	pnpm dev -- -q

dev-tools: ## Start development server with additional tools (Redis, n8n, Flowise, etc.)
	pnpm dev -- -t

dev-all: ## Start development server with all apps (portal, CMS, overview)
	pnpm dev -- --all

# Building
build: ## Build all packages and apps
	pnpm build

analyze: ## Analyze bundle sizes
	ANALYZE=true pnpm --filter portal build

# Testing
test: ## Run unit tests
	pnpm test

test-e2e: ## Run E2E tests (requires dev server)
	pnpm test:e2e

test-watch: ## Run tests in watch mode
	pnpm --filter portal test -- --watch

test-coverage: ## Run tests with coverage
	pnpm --filter portal test -- --coverage

# Quality
lint: ## Run linter
	pnpm lint

lint-fix: ## Fix linting issues
	pnpm lint --fix

lint-root: ## Lint root directory only
	pnpm lint:root

type-check: ## Run TypeScript type checking
	pnpm type-check

format: ## Format code with Prettier
	pnpm format

format-check: ## Check code formatting
	pnpm format:check

md-lint: ## Lint markdown files
	pnpm md:lint

md-fix: ## Fix markdown files
	pnpm md:fix

quality: ## Run full quality gate (lint, type-check, test, format, etc.)
	pnpm quality

# Dependencies
deps-lint: ## Check dependency version consistency
	pnpm deps:lint

deps-fix: ## Fix dependency version mismatches
	pnpm deps:fix

deps-check: ## List dependency mismatches
	pnpm deps:check

knip: ## Check for unused exports and dependencies
	pnpm knip

knip-fix: ## Fix unused exports and dependencies
	pnpm knip:fix

# Database
db-gen: ## Generate TypeScript types from Supabase schema
	pnpm --filter @repo/database supabase:gen

db-push: ## Push migrations to local Supabase
	pnpm --filter @repo/database supabase:push

db-reset: ## Reset local Supabase (destructive)
	pnpm --filter @repo/database supabase:reset

db-start: ## Start local Supabase
	pnpm --filter @repo/database supabase:dev

db-docs: ## Generate database documentation
	pnpm db:docs

# Monitoring
monitor: ## Start monitoring HUD
	pnpm monitor

monitor-grafana: ## Start Grafana monitoring stack
	pnpm monitor:grafana

monitor-stop: ## Stop Grafana monitoring stack
	pnpm monitor:grafana-stop

# Deployment
deploy-local: ## Deploy to local environment
		pnpm deploy:local

deploy-dashboards: ## Start Glance + Dashy sidecar dashboards
		docker compose -f infra/docker/compose.dashboards.yml up -d

deploy-dashboards-stop: ## Stop Glance + Dashy sidecar dashboards
		docker compose -f infra/docker/compose.dashboards.yml down

deploy-staging: ## Deploy to staging
	pnpm deploy:staging

deploy-production: ## Deploy to production
	pnpm deploy:production

deploy-rollback: ## Rollback production deployment
	pnpm deploy:rollback

fresh-start: ## Clean rebuild from scratch
	pnpm fresh-start

shutdown: ## Shutdown all services
	pnpm shutdown

# UI Components
ui: ## Open shadcn/ui CLI
	pnpm ui

# Cleanup
clean: ## Clean build artifacts and caches
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/.next
	rm -rf .nx/cache
	rm -rf .next
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

clean-cache: ## Clean Nx cache only
	rm -rf .nx/cache

clean-docker: ## Clean Docker containers and volumes
	docker-compose -f infra/docker/compose.tools.yml down -v
	docker-compose -f infra/monitoring/docker-compose.yml down -v
	docker-compose -f infra/docker/compose.redis.yml down -v
	docker-compose -f infra/docker/compose.production.yml down -v

# Git hooks
hooks-install: ## Install git hooks
	pnpm prepare

# Policy and security
policy-gen: ## Generate policy files
	pnpm policy:gen

policy-check: ## Check policy compliance
	pnpm policy:check

audit-rls: ## Audit RLS policies
	pnpm audit:rls

# Workspace commands
workspace-list: ## List workspace packages
	pnpm --filter "*" exec pwd

workspace-graph: ## Show workspace dependency graph
	pnpm --graph

# Help and info
info: ## Show project information
	@echo 'Arch-Systems Project'
	@echo '===================='
	@echo 'Node.js: $(shell node --version)'
	@echo 'pnpm: $(shell pnpm --version)'
	@echo 'Working directory: $(shell pwd)'
