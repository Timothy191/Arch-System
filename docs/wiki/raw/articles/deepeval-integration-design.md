---
source_url: file:///home/timothy/Project/Arch-Mk2/docs/superpowers/specs/2026-05-14-deepeval-integration-design.md
ingested: 2026-05-14
sha256: 2aa823dec037883d4689931de0044c887f47a8478eecbe3f8cce11bc26c5551b
---

# DeepEval Integration Design

## Purpose

Set up DeepEval (LLM evaluation framework) in the Arch-Mk2 monorepo to evaluate:

1. **Portal AI Service Quality** — Test the Groq/OpenRouter/Together AI prompts (predictive maintenance, shift handoff, safety compliance, equipment manual, translation) against metrics like hallucination, factual consistency, and answer relevancy.
2. **Claude Code Generation Quality** — Custom test cases that measure whether Claude produces code that follows Arch-Mk2 conventions (design system, Supabase imports, RLS policies, department patterns).

## Components

### 1. Portal AI Service Tests

Each AI prompt gets test cases with:

- **Golden inputs**: realistic mining operations data
- **Expected output properties**: JSON structure, risk levels, actionable recommendations
- **Metrics**: `HallucinationMetric`, `AnswerRelevancyMetric`, `FactualConsistencyMetric`, `NonToxicMetric`, `UnBiasedMetric`

### 2. Code Generation Tests

Custom `BaseMetric` subclasses:

- **DesignSystemComplianceMetric** checks: no forbidden Tailwind classes, uses design token colors, uses `cn()` and `GlassCard`
- **SupabaseImportComplianceMetric** checks: imports from `@repo/supabase/*`, never from `@supabase/supabase-js`
- **RLSCompletenessMetric** checks: `ENABLE ROW LEVEL SECURITY` on all new tables, policies use auth helpers
- **DepartmentPatternComplianceMetric** checks: uses `getDepartmentContext()`, `requireDepartment()`, `KPICard`, `PageHeader`

### 3. AI Service Helper (`helpers.py`)

Handles invoking the portal's AI endpoint. Live mode sends requests to `http://localhost:3000/api/ai/chat`. Cached mode loads pre-recorded responses from `datasets/golden_cases.json`.

### 4. Configuration

- Python 3.10+, Poetry managed in `packages/eval/`
- Added to `pnpm-workspace.yaml` for awareness
- Requires `OPENAI_API_KEY` for LLM-based metrics
