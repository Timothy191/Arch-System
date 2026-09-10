# GEMINI.md - Arch-System Guidelines for Gemini & Antigravity

This file provides instruction and guidelines for Google Gemini and Antigravity agents working in the Arch-Systems codebase.

## Repository Overview

Arch-Systems (Plantcor) is a multi-departmental mining operations portal built as an **Turborepo 2.x + pnpm** monorepo with Next.js 16 App Router, PostgreSQL/RLS, Redis caching, and Python LLM eval suite.

Refer to [AGENTS.md](file:///home/timothy/orca/Arch-System/AGENTS.md) for the authoritative repository guidelines, coding conventions, architectural boundaries, and workflow specifications.

## Core Directives & Quality Gates

1. **Always Light Mode**: Invariant UI rule — strictly light mode (#f3f4f6 background, luminance > 200). Never introduce `dark:` Tailwind classes.
2. **Design Tokens**: Rely on OKLCH tokens from `@repo/theme`. Use only approved shadow tokens.
3. **Quality Gate**: Always ensure `pnpm quality` passes before completing work.
4. **Architectural Boundaries**: Public package APIs must export strictly from `src/index.ts`. Never cross domain boundaries or import server-only code into client components.
5. **Type Safety**: Strict TypeScript throughout. Never use `any` or `@ts-ignore`.
