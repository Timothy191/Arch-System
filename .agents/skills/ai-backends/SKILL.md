---
name: ai-backends
description: Unified multi-backend routing, fallback orchestration, and skill installation management with zero external API overhead.
---

# AI Backends Operational Runbook

## Overview

AI Backends provides unified switching, comparative evaluation, and fallback orchestration across local Ollama instances, Gemini native endpoints, and containerized inference runners.

---

## 1. Core Workflows

| Capability                | Command / Protocol               | Description                                                   |
| :------------------------ | :------------------------------- | :------------------------------------------------------------ |
| **Skill Installation**    | `npx skills add <owner/repo>`    | Automated agent skill provisioning from upstream repositories |
| **Local Model Routing**   | `ollama run qwen2.5:3b`          | 0$ cost local parameter execution (<3B params, 4-bit quant)   |
| **Containerized Backend** | `docker build -t ai-backends .`  | Local container deployment for isolated model backends        |
| **Fallback Cascade**      | Native Gemini $\to$ Local Ollama | Automatic failover on connection or rate-limit thresholds     |

---

## 2. Agent Workflow Integration

- **Dynamic Skill Provisioning**: Autonomous agents invoke `npx skills add <owner/repo>` when encountering missing specialized domain runbooks.
- **Offline Inference**: During air-gapped or network-degraded operations, agents seamlessly route to local Ollama backends.
