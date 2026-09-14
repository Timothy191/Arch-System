---
name: agent-ready
description: Automated scanning and grading of web endpoints, MCP cards, A2A manifests, and llms.txt files against the Vercel Agent Readability Spec.
---

# Agent Ready Scanner Runbook

## Overview

`agent-ready` scans local and remote URL endpoints to evaluate how effectively AI agents can discover, parse, and interact with the application according to modern agentic standards (MCP cards, A2A protocols, `llms.txt`, JSON-LD schemas).

---

## 1. Core Commands

| Command                                | Action                                                    | Example                                              |
| :------------------------------------- | :-------------------------------------------------------- | :--------------------------------------------------- |
| `agent-ready scan <url>`               | Scan web portal URL for agent readability                 | `agent-ready scan http://localhost:3000 --json`      |
| `agent-ready mcp-scan <url>`           | Grade live MCP server endpoint manifest                   | `agent-ready mcp-scan http://localhost:3000/api/mcp` |
| `agent-ready validate-schema <url\|->` | Validate JSON-LD structured data                          | `cat page.jsonld \| agent-ready validate-schema -`   |
| `agent-ready ask "<query>"`            | Query agent readability specifications & scoring criteria | `agent-ready ask "how is the score calculated?"`     |

---

## 2. Agent Workflow Integration

- **Pre-Deploy Web Accessibility Check**: Autonomous agents run `agent-ready scan http://localhost:3000` to verify that Next.js portal endpoints expose valid machine-readable metadata.
