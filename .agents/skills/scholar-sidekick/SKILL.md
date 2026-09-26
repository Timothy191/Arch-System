---
name: scholar-sidekick
description: Academic identifier resolution (DOI, PMID, arXiv, ISBN) into 10,000+ citation styles, export formats, and retraction verification.
---

# Scholar Sidekick Operational Runbook

## Overview

`scholar-sidekick` resolves scholarly identifiers across international databases (DOI, PMID, arXiv, ISBN) into formatted citations and executes retraction and citation-fabrication checks directly from the CLI.

---

## 1. Core Commands

| Command                              | Action                                            | Example                                                    |
| :----------------------------------- | :------------------------------------------------ | :--------------------------------------------------------- |
| `scholar resolve <id>`               | Resolve identifier to metadata & citations        | `scholar resolve 10.1038/s41586-020-2649-2`                |
| `scholar export <id> --format <fmt>` | Export citation to BibTeX, RIS, APA, IEEE         | `scholar export 10.1038/s41586-020-2649-2 --format bibtex` |
| `scholar check <id>`                 | Run retraction, open-access, and integrity checks | `scholar check 10.1038/s41586-020-2649-2`                  |

---

## 2. Agent Workflow Integration

- **Scientific & Technical Reference Verification**: Autonomous agents cite peer-reviewed algorithms (e.g. mining geostatistics, ore grading, predictive maintenance algorithms) with verified DOIs.
