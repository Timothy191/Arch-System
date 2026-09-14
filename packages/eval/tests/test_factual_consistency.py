from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import FaithfulnessMetric, HallucinationMetric

from helpers import get_judge_model


def test_ai_response_factual_consistency():
    # Example input and output for a critical AI-generated shift report
    input_text = "Summarize the pump failure from shift A."
    actual_output = (
        "Pump 3 failed at 10:00 AM due to a ruptured seal. Maintenance replaced it by 11:30 AM."
    )
    retrieval_context = [
        "Pump 3 experienced a seal rupture at 10:00 AM. It was repaired by maintenance team at 11:30 AM."
    ]

    test_case = LLMTestCase(
        input=input_text,
        actual_output=actual_output,
        retrieval_context=retrieval_context,
        context=retrieval_context,  # HallucinationMetric reads `context` in deepeval 4.2.2
    )

    # Route the judge through the most beneficial configured provider
    # (Gemini via GEMINI_API_KEY, else Ollama, else DeepEval's default).
    judge = get_judge_model()

    # Define strict threshold for faithfulness (Must be 100% accurate for mining ops)
    faithfulness_metric = FaithfulnessMetric(threshold=1.0, model=judge)

    # Hallucination metric (Should be 0.0 or strict threshold)
    hallucination_metric = HallucinationMetric(threshold=0.2, model=judge)

    assert_test(test_case, [faithfulness_metric, hallucination_metric])
