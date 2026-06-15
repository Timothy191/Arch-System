"""DeepEval pytest configuration for Arch-Systems evaluation suite."""

import os
import pytest

# DeepEval configuration
# Set OPENAI_API_KEY in your environment before running tests:
#   export OPENAI_API_KEY=sk-...
# Or create a .env file in this directory with:
#   OPENAI_API_KEY=sk-...

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