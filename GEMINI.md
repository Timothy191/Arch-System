# Repository Guidelines

This file provides guidance to Gemini CLI and Claude Code when working in this repository.

Arch-System (Plantcor / Arch OS) is a Next.js 16 App Router + React 19 monorepo for an industrial mining portal, on Node 24 and pnpm 9.15.9, backed by cloud Supabase and Redis.

All guidance lives in [`AGENTS.md`](AGENTS.md): toolchain pins, non-obvious commands, gate-enforced invariants, gotchas, and where the detailed rules are. Read it before starting work.

Non-negotiable:

- Run every command from this repo root, with `pnpm` only.
- `pnpm agent:verify` must pass before claiming work is complete.
- Never push to `origin/main` or run `pnpm deploy:vercel:prod` without explicit user approval.
- Domain rules live in `.agents/rules/`; repeatable workflows in `.qoder/skills/`.
