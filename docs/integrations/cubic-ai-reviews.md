# Cubic AI Code Review Integration (Vercel Marketplace)

[Cubic](https://vercel.com/marketplace/cubic) is an autonomous AI-powered code reviewer and agent integrated via the Vercel Marketplace.

## Overview

- **AI Code Reviews**: Inspects pull requests with complete AST and codebase context to identify regressions, performance bottlenecks, and security vulnerabilities.
- **Automated PR Summaries**: Generates high-level architectural summaries and change rationales for pull requests.
- **Rule Enforcement**: Verifies repository guidelines (e.g. OKLCH color token conformance, zero-drift contracts, durable workflow directives).
- **Background Agents**: Autonomous fix suggestions and code remediation.

## Installation & Setup

Install the Cubic integration on Vercel:

```bash
# Via Vercel CLI
vc i cubic

# Or directly from the Vercel Marketplace:
# https://vercel.com/marketplace/cubic
```
