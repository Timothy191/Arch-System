"""Translation AI service evaluation."""

import pytest
from conftest import requires_openai
from deepeval import assert_test
from deepeval.metrics import FaithfulnessMetric
from deepeval.test_case import LLMTestCase

from datasets.golden_cases import TRANSLATION_INPUTS
from helpers import call_ai_service


@pytest.mark.ai_service
@requires_openai
@pytest.mark.asyncio
class TestTranslation:
    """Evaluate the translation AI prompt."""

    @pytest.mark.parametrize("case", TRANSLATION_INPUTS)
    async def test_terminology_preservation(self, case, portal_base_url, use_cache):
        """Technical terms must be accurately preserved in translation."""
        actual_output = await call_ai_service("translate", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
            context=case["context"],
        )
        # Factual consistency checks that the meaning and terminology are preserved
        consistency = FaithfulnessMetric(threshold=0.85)
        assert_test(test_case, [consistency])
