---
name: testing-rules
description: Invoke testing-rules skill for testing standards and mocking strategies
paths:
  - '**/*.test.{ts,tsx}'
  - '**/*.spec.{ts,tsx}'
  - 'apps/portal/jest.config.js'
  - 'apps/portal/setupTests.ts'
---

# Testing Standards & Mocking Rules

**Mandatory Skill Activation**: When writing or modifying tests, invoke the `testing-rules` skill to enforce unit isolation, network boundary mocking, BDD naming conventions, and Jest diagnostic guards.

See `skill://testing-rules` for full protocol details.
