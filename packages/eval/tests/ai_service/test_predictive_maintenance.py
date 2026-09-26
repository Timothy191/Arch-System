"""Predictive maintenance AI service evaluation."""

import pytest
from conftest import requires_openai
from deepeval import assert_test
from deepeval.metrics import HallucinationMetric, FaithfulnessMetric, AnswerRelevancyMetric
from deepeval.test_case import LLMTestCase

from datasets.golden_cases import PREDICTIVE_MAINTENANCE_INPUTS
from helpers import call_ai_service


@pytest.mark.ai_service
@requires_openai
@pytest.mark.asyncio
class TestPredictiveMaintenance:
    """Evaluate the predictive maintenance AI prompt."""

    @pytest.mark.parametrize("case", PREDICTIVE_MAINTENANCE_INPUTS)
    async def test_no_hallucination(self, case, portal_base_url, use_cache):
        """AI should not introduce information outside the provided context."""
        actual_output = await call_ai_service("predictiveMaintenance", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
            context=case["context"],
        )
        hallucination = HallucinationMetric(threshold=0.7)
        assert_test(test_case, [hallucination])

    @pytest.mark.parametrize("case", PREDICTIVE_MAINTENANCE_INPUTS)
    async def test_factual_consistency(self, case, portal_base_url, use_cache):
        """AI output should be factually consistent with provided context."""
        actual_output = await call_ai_service("predictiveMaintenance", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
            context=case["context"],
        )
        factual = FaithfulnessMetric(threshold=0.8)
        assert_test(test_case, [factual])

    @pytest.mark.parametrize("case", PREDICTIVE_MAINTENANCE_INPUTS)
    async def test_answer_relevancy(self, case, portal_base_url, use_cache):
        """AI should return relevant risk assessment and actions."""
        actual_output = await call_ai_service("predictiveMaintenance", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
        )
        relevancy = AnswerRelevancyMetric(threshold=0.7)
        assert_test(test_case, [relevancy])