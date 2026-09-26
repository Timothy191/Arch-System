---
name: sidekick-cli
description: Autonomous application deployment, container provisioning, live health monitoring, and rollback management utilizing Sidekick CLI.
---

# Sidekick CLI Operational Runbook

## Overview

Sidekick CLI automates staging pipelines, live-local deployments, container provisioning, and infrastructure health checking with zero external API dependencies.

---

## 1. Command Reference

| Command                        | Action                                                                        | Example                       |
| :----------------------------- | :---------------------------------------------------------------------------- | :---------------------------- |
| `sidekick deploy <target>`     | Trigger automated deployment pipeline (`local`, `staging`, `cloudflare`)      | `sidekick deploy staging`     |
| `sidekick provision <service>` | Validate and provision infrastructure containers (`supabase`, `redis`, `all`) | `sidekick provision supabase` |
| `sidekick health`              | Run live multi-port health check                                              | `sidekick health --json`      |
| `sidekick status`              | Inspect container status and active ports                                     | `sidekick status`             |

---

## 2. Agent Workflow Integration

- **Post-Refactor Deployment Verification**: Autonomous agents execute `sidekick health` after applying changes to confirm live service availability.
- **Automated Staging Delivery**: Swarm specialists invoke `sidekick deploy staging` to push verified changes through deployment gates.
