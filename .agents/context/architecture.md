# Arch-System Architecture Context Injection

> **Context:** Mining Operations Platform (Plantcor OS)  
> **Authority:** SSoT defined in `AGENTS.md` and `.agents/SYSTEMS.md`

## Key System Invariants

1. **Light-Mode OKLCH Design Tokens:** Strictly enforce light-mode OKLCH colors; never use hardcoded hex or dark mode overrides in production components.
2. **Offline-Resilient Telemetry:** SCADA and SMR telemetry streams must handle lie-fi and intermittent connectivity with local queue buffering.
3. **No Root Runner:** Never run `pnpm` from the `/home/tim/Fork` root workspace directory. Scope all commands within `Arch-System/` or its siblings.
4. **Zero External API Cost:** Gemini / Antigravity for model inference; local transformers.js and Ollama `nomic-embed-text` for embeddings; local Firecrawl (`192.168.0.215:3002`) for scraping.
5. **Maker-Checker Quality Gates:** Minimum 90/100 score required before merging architectural or database mutations.
