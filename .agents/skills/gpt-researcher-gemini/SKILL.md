---
name: gpt-researcher-gemini
description: Autonomous AI research agent powered by GPT-Researcher and Gemini Pro/Flash.
---

# GPT-Researcher (Gemini Powered)

## Overview
`gpt-researcher` is an autonomous AI research agent that can scrape, summarize, and synthesize massive amounts of web data. We have explicitly configured it to use the **Gemini Engine** for all smart and fast operations.

## Autonomous Usage
To execute deep-dive research tasks, the swarm must utilize the GPT-Researcher CLI or Python module. 
The configuration file `.env.researcher` contains the Gemini mapping.
```bash
# Example invocation (ensure API keys are loaded)
export $(cat .env.researcher | xargs)
gpt-researcher "Analyze the performance of modern SSR frameworks against pure SPA architectures"
```
