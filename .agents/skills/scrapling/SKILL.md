---
name: scrapling
description: High-performance, anti-bot web scraping and RAG markdown generation using Scrapling.
---

# Scrapling Web Scraper

## Overview
`Scrapling` is our authorized high-performance web scraping and markdown generation library. It natively supports converting web pages directly into LLM-ready markdown formats, bypassing heavy DOM parsing.

## Autonomous Usage
If the swarm needs to extract specific data from external documentation or web sources, write a fast python script utilizing `scrapling`:
```python
from scrapling import Fetcher
fetcher = Fetcher(auto_match=True)
response = fetcher.get("https://example.com")
print(response.markdown())
```
