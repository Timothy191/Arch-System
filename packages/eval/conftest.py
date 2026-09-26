"""DeepEval pytest configuration for Arch-Systems evaluation suite."""

import os
from pathlib import Path

import pytest


def _load_root_dotenv() -> None:
    """Load KEY=VALUE pairs from the gitignored repo-root .env into os.environ.

    DeepEval reads provider keys (OPENAI_API_KEY / GEMINI_API_KEY) from the
    process environment only, so a key sitting in `.env` is invisible unless
    exported. This zero-dependency loader makes the eval honor the repo's
    `.env` on every run without a manual `export`, and never overrides an
    already-set environment variable.
    """
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key and value and key not in os.environ:
            os.environ[key] = value


_load_root_dotenv()

# DeepEval configuration
# Keys are read from the process environment (populated from the repo-root
# `.env` above) — OPENAI_API_KEY for the default OpenAI judge, or
# GEMINI_API_KEY to route the judge through GeminiModel (see helpers.py).

_HAS_REAL_OPENAI_KEY = (
    os.environ.get("OPENAI_API_KEY", "").startswith("sk-")
    and not os.environ.get("OPENAI_API_KEY", "").startswith("sk-dummy")
    and len(os.environ.get("OPENAI_API_KEY", "")) > 20
)

requires_openai = pytest.mark.skipif(
    not _HAS_REAL_OPENAI_KEY,
    reason="OPENAI_API_KEY not set — skipping LLM-judge AI service tests",
)


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "ai_service: tests that call the portal AI service")
    config.addinivalue_line("markers", "code_gen: tests that evaluate code generation compliance")


@pytest.fixture(scope="session")
def portal_base_url():
    """Base URL for the running portal (for AI service tests)."""
    return os.environ.get("PORTAL_BASE_URL", "http://localhost:3000")


@pytest.fixture(scope="session")
def use_cache():
    """Whether to use cached golden responses instead of live API calls."""
    return os.environ.get("EVAL_USE_CACHE", "true").lower() == "true"
