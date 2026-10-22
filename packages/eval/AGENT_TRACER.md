# Agent Tracer Reference: packages/eval

All discrete agent task executions and historical changelogs are permanently indexed in the centralized archive:

- **Master Index:** [`archive/tracers/README.md`](../../archive/tracers/README.md)
- **Task Log Directory:** [`archive/tracers/log/`](../../archive/tracers/log/)

---

## 2026-09-14T04:37:33Z — Permanent LLM judge routing (Gemini-first)

- Added `get_judge_model()` to `helpers.py` — resolves the DeepEval judge with priority: Gemini (`GEMINI_API_KEY` → `gemini-3.8-flash`) → local Ollama (`OPENAI_BASE_URL` pointing at `:11434` → `qwen2.5:3b`) → DeepEval default.
- Added a zero-dependency repo-root `.env` loader to `conftest.py` so keys in the gitignored root `.env` reach `os.environ` for every run.
- Wired `judge` into `FaithfulnessMetric` and `HallucinationMetric` in `tests/test_factual_consistency.py`; added `context=` alongside `retrieval_context=` (deepeval 4.2.2's `HallucinationMetric` reads `context`).
- Added `google-genai` to `pyproject.toml` (both `[project]` and `[tool.poetry.dependencies]`) and synced `uv.lock`.
- API keys live only in the gitignored root `.env` (never in tracked files). Verification of a live Gemini round-trip succeeded; repeated runs are subject to free-tier 503/429 capacity throttling.

## 2026-10-22T22:47:35Z — Modernization kit pass (TDAD-verified)

- Replaced deprecated typing primitives with `collections.abc.AsyncGenerator` and `str | None` in `antigravity_agent_runner.py`.
- Removed dead code: unused `CACHE_DIR`, uncalled `call_ai_service_sync()`, always-false `requires_openai` marker, unused `_HAS_REAL_OPENAI_KEY`, and mid-file imports.
- Added debug logging to intentional provider/SDK fallback paths; hoisted imports and simplified conditions in the four compliance metrics.
- TDAD mapped `helpers.py` to five AI-service suites and the metrics to the two code-generation suites. Verification: `ruff check` clean; `pytest -q` 24 passed. Token delta −105 (13,098 → 12,993), −10 lines.
