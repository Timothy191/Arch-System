---
title: DeepEval Evaluation Suite
created: 2026-05-14
updated: 2026-05-16
type: concept
tags: [testing, system, project]
sources: [raw/articles/deepeval-integration-design.md]
confidence: high
---

# DeepEval Evaluation Suite

The Arch-Systems evaluation suite (in `packages/eval/`) uses DeepEval to assess AI service quality and code generation compliance against project conventions.

## Architecture

- `pyproject.toml` — Poetry project, DeepEval + pytest
- `conftest.py` — pytest + DeepEval plugin config, shared fixtures
- `helpers.py` — `call_ai_service()` for live or cached AI calls
- `datasets/golden_cases.json` — Pre-recorded expected inputs/outputs
- `metrics/` — Custom BaseMetric subclasses
- `tests/ai_service/` — AI prompt evaluation tests
- `tests/code_generation/` — Code convention compliance tests

## AI Service Tests

- `test_predictive_maintenance.py` — Hallucination + factual consistency
- `test_shift_handoff.py` — Answer relevancy + hallucination
- `test_safety_compliance.py` — Factual consistency + bias detection
- `test_equipment_manual.py` — Answer relevancy + hallucination
- `test_translation.py` — Factual consistency (terminology preservation)

## Custom Metrics

- `DesignSystemComplianceMetric` — Forbidden Tailwind classes, correct tokens, `cn()` and `GlassCard`
- `SupabaseImportComplianceMetric` — Imports from `@repo/supabase/*`, never direct `@supabase/supabase-js`
- `RLSCompletenessMetric` — `ENABLE ROW LEVEL SECURITY`, policies use auth helpers
- `DepartmentPatternComplianceMetric` — `getDepartmentContext()`, `requireDepartment()`, `KPICard`, `PageHeader`

## Configuration

- `OPENAI_API_KEY` required for LLM-based metrics
- `PORTAL_BASE_URL` for live AI tests (default: `http://localhost:3000`)
- `EVAL_USE_CACHE=true` for cached mode (default)

## Running Tests

```bash
cd packages/eval
poetry install
poetry run pytest                          # Run all tests
poetry run pytest tests/ai_service/        # AI service tests only
poetry run pytest tests/code_generation/   # Code convention tests only
poetry run pytest -k "test_predictive"     # Run specific test
poetry run pytest -v                       # Verbose output
```

## Adding a New Custom Metric

1. Create a new file in `packages/eval/metrics/`:

```python
from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase

class MyCustomMetric(BaseMetric):
    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold

    def measure(self, test_case: LLMTestCase) -> float:
        # Your evaluation logic here
        score = self._evaluate(test_case.actual_output)
        self.score = score
        return score

    def _evaluate(self, output: str) -> float:
        # Implementation
        pass

    def is_successful(self) -> bool:
        return self.score >= self.threshold

    @property
    def __name__(self):
        return "My Custom Metric"
```

2. Import and use in a test file under `tests/code_generation/`
3. Add to `conftest.py` if it needs shared fixtures

## Example Test Output

```
tests/ai_service/test_predictive_maintenance.py::test_hallucination PASSED [ 20%]
tests/ai_service/test_predictive_maintenance.py::test_factual_consistency PASSED [ 40%]
tests/ai_service/test_shift_handoff.py::test_answer_relevancy PASSED [ 60%]
tests/code_generation/test_design_system.py::test_forbidden_classes PASSED [ 80%]
tests/code_generation/test_supabase_imports.py::test_import_compliance PASSED [100%]

Results: 5 passed in 12.34s
```

## Related

- [[arch-systems]] — the portal whose code and AI are evaluated
- [[rls-policy]] — enforced by RLSCompletenessMetric
- [[design-system]] — enforced by DesignSystemComplianceMetric
