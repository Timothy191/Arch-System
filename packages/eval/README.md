# Arch-Systems Evaluation Suite

LLM evaluation framework using [DeepEval](https://github.com/AI-App/DeepEval) for testing AI service quality and Claude code generation compliance.

## Setup

```bash
cd packages/eval

# Install dependencies
poetry install

# Set your OpenAI API key (required for DeepEval's LLM-based metrics)
export OPENAI_API_KEY=sk-your-key-here

# (Optional) Set portal URL for live AI service tests
export PORTAL_BASE_URL=http://localhost:3000
```

## Running Tests

```bash
# Run all evaluations
poetry run pytest tests/ -v

# Run only AI service tests (requires running portal or cached responses)
poetry run pytest tests/ai_service/ -v -m ai_service

# Run only code generation compliance tests
poetry run pytest tests/code_generation/ -v -m code_gen

# Run a single test file
poetry run pytest tests/ai_service/test_predictive_maintenance.py -v

# Run with cached responses (no portal needed)
EVAL_USE_CACHE=true poetry run pytest tests/ai_service/ -v
```

## Test Categories

### AI Service Tests (`tests/ai_service/`)

Evaluate the portal's AI service prompts (predictive maintenance, shift handoff, safety compliance, equipment manual, translation) against DeepEval's built-in metrics:

- **HallucinationMetric** — Does the AI introduce information not in the context?
- **FactualConsistencyMetric** — Is the output factually aligned with provided context?
- **AnswerRelevancyMetric** — Is the response relevant to the input?
- **UnBiasedMetric** — Is the output free from bias?

### Code Generation Tests (`tests/code_generation/`)

Evaluate Claude's code output against Arch-Systems project conventions using custom metrics:

- **DesignSystemComplianceMetric** — Checks forbidden Tailwind patterns, design token usage, `cn()` for class merging, `GlassCard` for cards
- **SupabaseImportComplianceMetric** — Checks correct `@repo/supabase/*` imports, no direct `@supabase/supabase-js`, proper client selection
- **RLSCompletenessMetric** — Checks RLS enable, policy coverage, auth helper usage, indexes
- **DepartmentPatternComplianceMetric** — Checks `getDepartmentContext()`, `requireDepartment()`, `KPICard`/`KPIGrid`, `PageHeader`, `FormFields`

## Custom Metrics

All custom metrics are in `metrics/`. Each extends `deepeval.metrics.BaseMetric` and implements `measure()` returning a score from 0.0 to 1.0.

To add a new metric:

1. Create `metrics/your_metric.py` extending `BaseMetric`
2. Implement `measure(test_case)` returning a float score
3. Add tests in `tests/code_generation/test_your_metric.py`

## Golden Cases

`datasets/golden_cases.json` contains pre-recorded AI service responses for offline evaluation. These are used when the portal is not running or `EVAL_USE_CACHE=true` is set.

To update golden cases, run the portal and execute:

```bash
EVAL_USE_CACHE=false poetry run pytest tests/ai_service/ --cache-record
```
