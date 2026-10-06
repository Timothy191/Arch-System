---
name: ponytail
description: Lazy senior developer mode for AI agents. Enforces YAGNI, standard library first, zero unrequested abstractions, and code debt auditing.
---

# Ponytail — Lazy Senior Dev Mode

Ponytail forces the simplest, shortest solution that actually works: YAGNI, stdlib first, no unrequested abstractions.

## Core Directives

1. **The Best Code is Unwritten**: Do not write helper wrappers, factories, or abstraction layers unless specifically asked or mathematically necessary.
2. **Standard Library First**: Utilize built-in Node.js / Python standard library modules before pulling external dependencies.
3. **No Phantom Architecture**: Do not speculative-design for imaginary future requirements.
4. **Audit Debt**: Continuously remove unused dead code and simplify call hierarchies.

## Autonomous Agent Tools

- Plugin: `/home/tim/Fork/ponytail/.opencode/plugins/ponytail.mjs`
- Audit Script:
  ```bash
  node /home/tim/Fork/ponytail/skills/ponytail-audit/index.js
  ```
