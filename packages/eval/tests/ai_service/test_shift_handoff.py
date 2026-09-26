"""Shift handoff AI service evaluation."""

import pytest
from conftest import requires_openai
from deepeval import assert_test
from deepeval.metrics import HallucinationMetric, AnswerRelevancyMetric
from deepeval.test_case import LLMTestCase

from datasets.golden_cases import SHIFT_HANDOFF_INPUTS
from helpers import call_ai_service


@pytest.mark.ai_service
@requires_openai
@pytest.mark.asyncio
class TestShiftHandoff:
    """Evaluate the shift handoff AI prompt."""

    @pytest.mark.parametrize("case", SHIFT_HANDOFF_INPUTS)
    async def test_no_hallucination(self, case, portal_base_url, use_cache):
        """AI should not fabricate shift events not in the data."""
        actual_output = await call_ai_service("shiftHandoff", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
            context=case["context"],
        )
        hallucination = HallucinationMetric(threshold=0.7)
        assert_test(test_case, [hallucination])

    @pytest.mark.parametrize("case", SHIFT_HANDOFF_INPUTS)
    async def test_answer_relevancy(self, case, portal_base_url, use_cache):
        """AI should produce actionable shift handoff summaries."""
        actual_output = await call_ai_service("shiftHandoff", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
        )
        relevancy = AnswerRelevancyMetric(threshold=0.7)
        assert_test(test_case, [relevancy])