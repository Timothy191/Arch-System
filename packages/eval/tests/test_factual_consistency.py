from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import FactualConsistencyMetric, HallucinationMetric

def test_ai_response_factual_consistency():
    # Example input and output for a critical AI-generated shift report
    input_text = "Summarize the pump failure from shift A."
    actual_output = "Pump 3 failed at 10:00 AM due to a ruptured seal. Maintenance replaced it by 11:30 AM."
    retrieval_context = ["Pump 3 experienced a seal rupture at 10:00 AM. It was repaired by maintenance team at 11:30 AM."]

    test_case = LLMTestCase(
        input=input_text,
        actual_output=actual_output,
        retrieval_context=retrieval_context
    )

    # Define strict threshold for factual consistency (Must be 100% accurate for mining ops)
    factual_consistency_metric = FactualConsistencyMetric(threshold=1.0)
    
    # Hallucination metric (Should be 0.0 or strict threshold)
    hallucination_metric = HallucinationMetric(threshold=0.2)

    assert_test(test_case, [factual_consistency_metric, hallucination_metric])
