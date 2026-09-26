---
name: n8n-qdrant-tools
description: Integration skill for utilizing n8n and Qdrant autonomously as persistent background AI tooling.
---

# Autonomous AI Tooling: n8n & Qdrant Runbook

## Overview
The swarm has been equipped with persistent, low-overhead background tooling running via Docker. 
- **n8n** is running on `http://localhost:5678`
- **Qdrant** is running on `http://localhost:6333`

These tools run continuously in the background and integrate directly into the frontend workflows, enabling the swarm to orchestrate complex API integrations (n8n) and semantic memory retrieval (Qdrant) completely autonomously.

## Accessing Qdrant (Vector Database)
You can autonomously create collections and query vectors using standard REST API calls via `curl` or by using the `replace_file_content` tool to write Python/JS scripts that interface with it.

- **Check Health:** `curl -s http://localhost:6333/`
- **List Collections:** `curl -s http://localhost:6333/collections`

### Autonomous Use Case
When a goal requires complex semantic search, long-term memory aggregation, or vector similarity, you must instantiate a Qdrant collection and stream the embeddings there instead of trying to hold them in context.

## Accessing n8n (Workflow Automation)
n8n is your autonomous background worker for webhooks, cron jobs, and third-party API orchestration.

- **Check Health:** `curl -s http://localhost:5678/healthz`
- **Execute Webhook:** `curl -X POST http://localhost:5678/webhook/<uuid> -d '{"data": "..."}'`

### Autonomous Use Case
When the frontend requires a background task (e.g., scraping, batch emails, syncing to Metabase), DO NOT write a custom Node.js cron job. Instead:
1. Generate an n8n workflow JSON file.
2. Instruct the user to import it into the n8n UI, OR push it directly via the n8n REST API (`POST /api/v1/workflows`).
3. Wire the frontend to call the n8n webhook URL.
