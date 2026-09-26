---
name: open-swe-agent
description: Autonomous PR fixing agent powered by open-swe and Gemini models.
---

# Open SWE Agent Integration

## Overview
`open-swe` is a software factory that automatically creates Pull Requests from Linear issues or GitHub feedback. It natively runs on Deep Agents by LangChain. 

Per user mandate, we have integrated it and strictly mapped it to the **Gemini Engine**.

## Autonomous Usage
When the swarm needs to completely offload a massive feature request (e.g., from an issue tracker) into a headless PR pipeline, run:
```bash
# Hand off to Open-SWE powered by Gemini
OPEN_SWE_MODEL="gemini-1.5-pro" npx @langchain/open-swe run "Implement issue #123"
```
