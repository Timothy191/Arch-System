"""Equipment manual AI service evaluation."""

import pytest
from conftest import requires_openai
from deepeval import assert_test
from deepeval.metrics import HallucinationMetric, FaithfulnessMetric
from deepeval.test_case import LLMTestCase

from datasets.golden_cases import EQUIPMENT_MANUAL_INPUTS
from helpers import call_ai_service


@pytest.mark.ai_service
@requires_openai
@pytest.mark.asyncio
class TestEquipmentManual:
    """Evaluate the equipment manual AI prompt."""

    @pytest.mark.parametrize("case", EQUIPMENT_MANUAL_INPUTS)
    async def test_no_hallucination(self, case, portal_base_url, use_cache):
        """AI should not invent facts about equipment."""
        actual_output = await call_ai_service("equipmentManual", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
            context=case["context"],
        )
        hallucination = HallucinationMetric(threshold=0.7)
        assert_test(test_case, [hallucination])

    @pytest.mark.parametrize("case", EQUIPMENT_MANUAL_INPUTS)
    async def test_factual_consistency(self, case, portal_base_url, use_cache):
        """AI should accurately answer based on provided manual context."""
        actual_output = await call_ai_service("equipmentManual", case["input"], use_cache=use_cache)
        test_case = LLMTestCase(
            input=case["input"],
            actual_output=actual_output,
            context=case["context"],
        )
        factual = FaithfulnessMetric(threshold=0.8)
        assert_test(test_case, [factual])
