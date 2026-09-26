# ==============================================================================
# Arch-Systems Docker Stack Makefile
# ==============================================================================

# Variables
DOCKER_COMPOSE := docker compose
DOCKER_DIR := infra/docker
MONITORING_DIR := infra/monitoring

# Default target
.PHONY: help
help:
	@echo "Arch-Systems Docker Management"
	@echo "=============================="
	@echo "Available commands:"
	@echo "  make up-dashboards  - Start the Dashboards stack"
	@echo "  make down-dashboards- Stop the Dashboards stack"
	@echo "  make up-tools       - Start the Tools stack (AI, Redis, Analytics)"
	@echo "  make down-tools     - Stop the Tools stack"
	@echo "  make up-redis       - Start the standalone Redis stack"
	@echo "  make down-redis     - Stop the standalone Redis stack"
	@echo "  make up-monitoring  - Start the Monitoring stack"
	@echo "  make down-monitoring- Stop the Monitoring stack"
	@echo "  make validate       - Validate all compose files"
	@echo "  make status         - Show status of all containers"
	@echo ""
	@echo "Workflow shortcuts (dash-named aliases of root pnpm scripts):"
	@echo "  make dev  build  test  lint  type-check  format  quality"
	@echo "  make test-e2e  test-watch  test-coverage  lint-fix  format-check"
	@echo "  make deps-lint  deps-fix  knip  knip-fix  md-lint  md-fix"
	@echo "  make policy-gen  policy-check  audit-rls  audit-design"
	@echo "  make fresh-start  shutdown  clean  clean-cache  clean-docker"

.PHONY: up-dashboards down-dashboards logs-dashboards ps-dashboards
up-dashboards:
	$(DOCKER_COMPOSE) -p arch-dashboards -f $(DOCKER_DIR)/compose.dashboards.yml --profile dashboards up -d

down-dashboards:
	$(DOCKER_COMPOSE) -p arch-dashboards -f $(DOCKER_DIR)/compose.dashboards.yml --profile dashboards down

logs-dashboards:
	$(DOCKER_COMPOSE) -p arch-dashboards -f $(DOCKER_DIR)/compose.dashboards.yml logs -f

ps-dashboards:
	$(DOCKER_COMPOSE) -p arch-dashboards -f $(DOCKER_DIR)/compose.dashboards.yml ps

.PHONY: up-tools down-tools logs-tools ps-tools
up-tools:
	$(DOCKER_COMPOSE) -p arch-tools -f $(DOCKER_DIR)/compose.tools.yml up -d

down-tools:
	$(DOCKER_COMPOSE) -p arch-tools -f $(DOCKER_DIR)/compose.tools.yml down

logs-tools:
	$(DOCKER_COMPOSE) -p arch-tools -f $(DOCKER_DIR)/compose.tools.yml logs -f

ps-tools:
	$(DOCKER_COMPOSE) -p arch-tools -f $(DOCKER_DIR)/compose.tools.yml ps

.PHONY: up-redis down-redis logs-redis ps-redis
up-redis:
	$(DOCKER_COMPOSE) -p arch-redis -f $(DOCKER_DIR)/compose.redis.yml up -d

down-redis:
	$(DOCKER_COMPOSE) -p arch-redis -f $(DOCKER_DIR)/compose.redis.yml down

logs-redis:
	$(DOCKER_COMPOSE) -p arch-redis -f $(DOCKER_DIR)/compose.redis.yml logs -f

ps-redis:
	$(DOCKER_COMPOSE) -p arch-redis -f $(DOCKER_DIR)/compose.redis.yml ps

.PHONY: up-monitoring down-monitoring logs-monitoring ps-monitoring
up-monitoring:
	$(DOCKER_COMPOSE) -p arch-monitoring -f $(MONITORING_DIR)/docker-compose.yml up -d

down-monitoring:
	$(DOCKER_COMPOSE) -p arch-monitoring -f $(MONITORING_DIR)/docker-compose.yml down

logs-monitoring:
	$(DOCKER_COMPOSE) -p arch-monitoring -f $(MONITORING_DIR)/docker-compose.yml logs -f

ps-monitoring:
	$(DOCKER_COMPOSE) -p arch-monitoring -f $(MONITORING_DIR)/docker-compose.yml ps

.PHONY: validate
validate:
	@echo "Validating Compose Files..."
	set -e; \
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.dashboards.yml config -q; \
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.tools.yml config -q; \
	$(DOCKER_COMPOSE) -f $(DOCKER_DIR)/compose.redis.yml config -q; \
	$(DOCKER_COMPOSE) -f $(MONITORING_DIR)/docker-compose.yml config -q
	@echo "All compose files are valid."

.PHONY: status
status:
	docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

.PHONY: status-caches clean-caches
status-caches:
	node scripts/manage-runtime-caches.mjs --status

clean-caches:
	node scripts/manage-runtime-caches.mjs --clean

# ==============================================================================
# Dev / Quality Workflow Shortcuts
#
# Dash-separated aliases for the root pnpm scripts, kept in sync with the
# "Makefile Shortcuts" table in CLAUDE.md. GNU make cannot name a target with a
# colon (make test:e2e: is a parse error), so each ':'-named pnpm script is
# exposed here as a '-'-named target (test:e2e -> make test-e2e).
# ==============================================================================

.PHONY: dev dev-quick dev-tools dev-all build
dev:
	pnpm run dev

dev-quick:
	pnpm run dev:quick

dev-tools:
	pnpm run dev:tools

dev-all:
	pnpm run dev:all:turbo

build:
	pnpm run build

.PHONY: test test-e2e test-watch test-coverage
test:
	pnpm run test

test-e2e:
	pnpm run test:e2e

test-watch:
	pnpm run test:watch

test-coverage:
	pnpm run test:coverage

.PHONY: lint lint-fix type-check
lint:
	pnpm run lint

lint-fix:
	pnpm run lint:fix

type-check:
	pnpm run type-check

.PHONY: format format-check quality
format:
	pnpm run format

format-check:
	pnpm run format:check

quality:
	pnpm run quality

.PHONY: deps-lint deps-fix knip knip-fix
deps-lint:
	pnpm run deps:lint

deps-fix:
	pnpm run deps:fix

knip:
	pnpm run knip

knip-fix:
	pnpm run knip:fix

.PHONY: md-lint md-fix
md-lint:
	pnpm run md:lint

md-fix:
	pnpm run md:fix

.PHONY: policy-gen policy-check
policy-gen:
	pnpm run policy:gen

policy-check:
	pnpm run policy:check

.PHONY: audit-rls audit-design
audit-rls:
	pnpm run audit:rls

audit-design:
	pnpm run audit:design

.PHONY: fresh-start shutdown
fresh-start:
	pnpm run fresh-start

shutdown:
	pnpm run shutdown

.PHONY: clean clean-cache clean-docker
clean:
	node scripts/manage-runtime-caches.mjs --clean \
	  && rm -rf .turbo node_modules/.cache/turbo \
	  apps/*/.next apps/*/dist packages/*/dist libs/*/*/dist

clean-cache:
	rm -rf .turbo node_modules/.cache/turbo

clean-docker:
	$(DOCKER_COMPOSE) -p arch-dashboards -f $(DOCKER_DIR)/compose.dashboards.yml down -v
	$(DOCKER_COMPOSE) -p arch-tools -f $(DOCKER_DIR)/compose.tools.yml down -v
	$(DOCKER_COMPOSE) -p arch-redis -f $(DOCKER_DIR)/compose.redis.yml down -v
	$(DOCKER_COMPOSE) -p arch-monitoring -f $(MONITORING_DIR)/docker-compose.yml down -v
	@echo "Docker stacks stopped and volumes removed."

