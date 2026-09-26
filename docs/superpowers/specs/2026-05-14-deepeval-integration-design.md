# DeepEval Integration Design

## Purpose

Set up DeepEval (LLM evaluation framework) in the Arch-Mk2 monorepo to evaluate two things:

1. **Portal AI Service Quality** — Test the Groq/OpenRouter/Together AI prompts (predictive maintenance, shift handoff, safety compliance, equipment manual, translation) against metrics like hallucination, factual consistency, and answer relevancy.
2. **Claude Code Generation Quality** — Custom test cases that measure whether Claude produces code that follows Arch-Mk2 conventions (design system, Supabase imports, RLS policies, department patterns).

## Architecture

```
packages/eval/
  pyproject.toml                     # Poetry project, DeepEval + deps, pytest config
  README.md                          # How to run evaluations
  conftest.py                        # Pytest + DeepEval plugin config, shared fixtures
  tests/
    ai_service/
      test_predictive_maintenance.py # Hallucination + factual consistency
      test_shift_handoff.py          # Answer relevancy + hallucination
      test_safety_compliance.py      # Factual consistency + bias detection
      test_equipment_manual.py       # Answer relevancy + hallucination
      test_translation.py            # Factual consistency (terminology preservation)
    code_generation/
      test_design_system.py          # Custom: forbidden Tailwind classes, correct tokens
      test_supabase_imports.py       # Custom: import from @repo/supabase, not direct
      test_rls_policies.py           # Custom: RLS enabled, policies complete, auth helpers used
      test_department_patterns.py    # Custom: getDepartmentContext, requireDepartment usage
  datasets/
    golden_cases.json                # Golden test cases with expected inputs/outputs
  helpers.py                         # call_ai_service() — calls portal API or uses cached responses
  metrics/
    design_system_compliance.py      # Custom BaseMetric: checks Tailwind class compliance
    supabase_import_compliance.py   # Custom BaseMetric: checks Supabase import patterns
    rls_completeness.py             # Custom BaseMetric: checks RLS policy coverage
    department_pattern_compliance.py # Custom BaseMetric: checks shared utility usage
```

## Components

### 1. Portal AI Service Tests

Each AI prompt gets test cases with:

- **Golden inputs**: realistic mining operations data (machine states, shift logs, safety reports)
- **Expected output properties**: JSON structure, risk levels, actionable recommendations
- **Metrics**: `HallucinationMetric`, `AnswerRelevancyMetric`, `FactualConsistencyMetric`, `NonToxicMetric`, `UnBiasedMetric`

Example test pattern:

```python
from deepeval import assert_test
from deepeval.metrics import HallucinationMetric, FactualConsistencyMetric
from deepeval.test_case import LLMTestCase
from helpers import call_ai_service

def test_predictive_maintenance_high_risk():
    machine_data = "Machine CAT-320 excavator, 4500 hours, hydraulic pressure dropping..."
    actual_output = call_ai_service("predictiveMaintenance", machine_data)
    test_case = LLMTestCase(
        input=machine_data,
        actual_output=actual_output,
        context=["CAT-320 maintenance manual states hydraulic service at 5000 hours..."],
    )
    hallucination = HallucinationMetric(minimum_score=0.7)
    factual = FactualConsistencyMetric(minimum_score=0.8)
    assert_test(test_case, [hallucination, factual])
```

### 2. Code Generation Tests

Custom `BaseMetric` subclasses that evaluate Claude's code output against Arch-Mk2 conventions:

**DesignSystemComplianceMetric** checks:

- No `font-bold`, `font-semibold`, `shadow-*`, `bg-white/5`, `border-white/10`, `text-white/50`, `text-white/70`
- Uses design token colors: `#0f0f0f`, `#171717`, `#242424`, `#363636`, `#3ecf8e`, `#fafafa`, `#898989`
- Uses `cn()` from `@repo/ui/lib/utils` for class merging
- Uses `GlassCard` for card containers

**SupabaseImportComplianceMetric** checks:

- Imports from `@repo/supabase/server`, `@repo/supabase/client`, `@repo/supabase/middleware`
- Never imports from `@supabase/supabase-js` directly
- Uses `createServerSupabaseClient()` in server components
- Uses `createBrowserSupabaseClient()` in client components

**RLSCompletenessMetric** checks:

- `ENABLE ROW LEVEL SECURITY` present on every new table
- SELECT, INSERT, UPDATE policies defined
- Policies use `auth.user_department_id()`, `auth.is_admin()`, or `auth.has_department_access()`
- DELETE restricted to admin or not present for audit tables

**DepartmentPatternComplianceMetric** checks:

- Department pages use `getDepartmentContext()` for lookup
- Restricted pages use `requireDepartment()`
- KPI cards use `KPICard`/`KPIGrid` from `@repo/ui/KPI`
- Page headers use `PageHeader` from `@repo/ui/PageHeader`

### 3. AI Service Helper (`helpers.py`)

The `call_ai_service()` function handles invoking the portal's AI endpoint:

- **Live mode**: Sends requests to `http://localhost:3000/api/ai/chat` with the prompt and context
- **Cached mode** (default for CI): Loads pre-recorded responses from `datasets/golden_cases.json` to avoid needing a running portal or API keys during evaluation
- Falls back to cached responses if the portal is unreachable

### 4. Configuration

- Python 3.10+ (required by DeepEval)
- Managed via Poetry in `packages/eval/`
- Added to `pnpm-workspace.yaml` only for awareness (it's Python, not pnpm-managed)
- Run via `cd packages/eval && poetry install && poetry run pytest`
- Requires `OPENAI_API_KEY` for LLM-based metrics (DeepEval uses GPT-4 as judge)
- Requires portal env vars for AI service tests (or mocks)

### 4. Running Tests

```bash
# Install
cd packages/eval && poetry install

# Run all evaluations
poetry run pytest tests/

# Run only AI service tests
poetry run pytest tests/ai_service/

# Run only code generation tests
poetry run pytest tests/code_generation/

# Run with verbose output
poetry run pytest tests/ -v

# Run single test
poetry run pytest tests/ai_service/test_predictive_maintenance.py -v
```

## Scope Boundaries

- **In scope**: AI service prompt evaluation, custom code-generation compliance metrics, golden dataset
- **Out of scope**: CI integration (future), Confident AI platform sync (future), automated Claude Code hooks (future)
