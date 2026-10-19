# Python & LLM Evaluation Suite Patterns (Arch-System SSoT)

> **EVALUATION INVARIANT**: Architectural patterns for LLM testing, RAG evaluation, deterministic AST compliance metrics, and golden dataset verification in `packages/eval/`.

---

## 1. Toolchain & Runtime Environment

The Arch-System evaluation suite is isolated in `packages/eval/` using `uv` for sub-second virtualenv resolution:

```bash
# Setup and run eval suite
cd packages/eval
uv sync
uv run pytest -v
```

---

## 2. Evaluation Architecture

```
+-------------------------------------------------------------------------+
|                           Golden Test Cases                             |
|                  (packages/eval/datasets/golden_cases.json)             |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            Pytest Test Harness                          |
|         (test_factual_consistency, test_equipment_manual, etc.)        |
+-------------------------------------------------------------------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+-----------------------------------+   +----------------------------------+
|      Deterministic AST Metrics    |   |     Semantic & LLM-as-a-Judge    |
| - rls_completeness                |   | - factual_consistency (0.0-1.0)  |
| - design_system_compliance (OKLCH)|   | - hallucination_score (0.0-1.0)  |
| - supabase_import_compliance      |   | - retrieval_precision & recall   |
| - department_pattern_compliance   |   | - Langfuse trace budget & tokens |
+-----------------------------------+   +----------------------------------+
```

---

## 3. Deterministic AST & Monorepo Compliance Metrics

Unlike non-deterministic LLM-as-a-judge tests, architectural invariants are validated deterministically via AST parsing and regular expression rules:

### Design System Compliance Metric (`design_system_compliance.py`)

Enforces the Monorepo Strict Light Mode Invariant (zero `dark:` classes, semantic OKLCH tokens):

```python
import re
from typing import Dict, Any

DARK_VARIANT_REGEX = re.compile(r'\bdark:[\w-]+')
RAW_HEX_REGEX = re.compile(r'#(?:[0-9a-fA-F]{3,4}){1,2}\b')

def evaluate_design_compliance(code_snippet: str) -> Dict[str, Any]:
    dark_violations = DARK_VARIANT_REGEX.findall(code_snippet)
    hex_violations = [h for h in RAW_HEX_REGEX.findall(code_snippet) if h.lower() != '#f3f4f6']

    passed = len(dark_violations) == 0 and len(hex_violations) == 0
    return {
        "passed": passed,
        "score": 1.0 if passed else 0.0,
        "violations": {
            "dark_variants": dark_violations,
            "raw_hex_colors": hex_violations,
        }
    }
```

### Architectural Boundary Metric (`supabase_import_compliance.py`)

Enforces the boundary rule preventing `apps/*` from importing `packages/database` directly:

```python
import re

ILLEGAL_DB_IMPORT = re.compile(r"from\s+['\"](?:@repo/database|\.\./packages/database)")

def evaluate_import_boundaries(file_path: str, content: str) -> bool:
    if "apps/portal" in file_path:
        if ILLEGAL_DB_IMPORT.search(content):
            return False  # Violation: apps must route via @repo/supabase
    return True
```

---

## 4. Factual Consistency & Hallucination Evaluation

Mining operations require zero hallucinations in shift handoffs and equipment troubleshooting. Evaluators verify facts against retrieved RAG chunks:

```python
import pytest
from packages.eval.helpers import compute_factual_overlap

@pytest.mark.asyncio
async def test_equipment_manual_rag_precision(golden_case):
    """Assert RAG retrieval contains exact equipment specifications without invented tolerances."""
    retrieved_chunks = await run_rag_pipeline(golden_case["query"])
    generated_answer = await run_agent_generation(golden_case["query"], retrieved_chunks)

    # 1. Fact containment check
    overlap_score = compute_factual_overlap(
        reference_facts=golden_case["ground_truth_facts"],
        generated_text=generated_answer
    )
    assert overlap_score >= 0.95, f"Hallucination detected in case {golden_case['id']}"

    # 2. Token & Latency Budget Enforcement
    assert golden_case["latency_ms"] < 2500, "Latency exceeded 2500ms budget"
    assert golden_case["total_tokens"] <= 4000, "Token consumption exceeded 4k limit"
```

---

## 5. Golden Dataset Management (`golden_cases.json`)

Test cases maintain strict structure including query, context chunks, ground truth facts, and expected metadata tags:

```json
{
  "test_cases": [
    {
      "id": "CAT-793F-BRAKE-OVERHEAT",
      "department": "drilling",
      "query": "What is the maximum operating temperature for CAT 793F rear wheel brakes?",
      "ground_truth_facts": [
        "Maximum allowable continuous temperature: 110°C",
        "Alarm trigger threshold: 125°C",
        "Mandatory shutdown threshold: 135°C"
      ],
      "forbidden_tokens": ["coolant flush", "unknown model"],
      "expected_sources": ["manuals/cat-793f-hydraulic-brakes.pdf"]
    }
  ]
}
```
