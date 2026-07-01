# Arch-Systems Infrastructure Documentation (`10_infrastructure_as_code/`)

This directory contains configuration files, deployment manifests, and automation scripts for running the platform's infrastructure stack.

## Directory Layout

- **[docker/](file:///home/timothy/Documents/Arch-System/10_infrastructure_as_code/docker)**: Centralized Docker Compose profiles for different services:
  - `compose.portal.yml`: Monorepo portal stack.
  - `compose.production.yml`: Production environment override parameters.
  - `compose.redis.yml`: Standalone Redis server config.
  - `compose.security.yml`: Security tools configuration.
  - `compose.tools.yml`: n8n, Flowise, and secondary workflow tooling.
- **[14_observability_configuration/](file:///home/timothy/Documents/Arch-System/10_infrastructure_as_code/monitoring)**: Contains the core observability stack definitions:
  - `docker-compose.yml`: Launches Prometheus and Grafana instances.
- **[observability/](file:///home/timothy/Documents/Arch-System/10_infrastructure_as_code/observability)**: Custom metric and diagnostic rules:
  - `grafana-dashboards/`: Configured dashboard templates.
  - `prometheus-rules/`: Alerting rules configuration.
- **[12_distributed_cache_runtime/](file:///home/timothy/Documents/Arch-System/10_infrastructure_as_code/redis)**: Redis caching configurations:
  - `07_toolchain_configuration/shard-map.json`: Active routing shard mapping.
  - `docker-compose/redis-cluster.yml`: Dev-cluster Redis setup.
  - `terraform/`: Infrastructure provisioning configurations (if targets include cloud provisioned nodes).
- **[k8s/](file:///home/timothy/Documents/Arch-System/10_infrastructure_as_code/k8s)**: Kubernetes deployments:
  - `manifests/cache-agent.yaml`: Scaled Deployment definition for cache synchronization. Note: This is an experimental manifest configuration.
- **[systemd/](file:///home/timothy/Documents/Arch-System/10_infrastructure_as_code/systemd)**: Production daemon files:
  - `arch-systems.service` & `arch-systems-local.service`.

## Getting Started

### Prerequisites

- Docker & Docker Compose (v2+)
- Terraform (if provisioning components via `/12_distributed_cache_runtime/terraform/`)
- Node.js (for tool execution via root `package.json` scripts)

### Execution Operations

- **Start Local Monitoring Stack**:

  ```bash
  pnpm monitor:grafana
  ```

- **Stop Monitoring Stack**:

  ```bash
  pnpm monitor:grafana-stop
  ```

- **Deploy Local Services**:
  Refer to the main root-level deployment script:

  ```bash
  ./03_operations_automation/deploy.sh local
  ```
