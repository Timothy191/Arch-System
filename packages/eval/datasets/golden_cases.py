"""Golden test cases with expected inputs and outputs for AI service evaluation."""

import json
from pathlib import Path

GOLDEN_CASES_FILE = Path(__file__).parent / "golden_cases.json"


def load_golden_cases() -> dict:
    """Load golden cases from JSON file."""
    if not GOLDEN_CASES_FILE.exists():
        return {}
    with open(GOLDEN_CASES_FILE) as f:
        return json.load(f)


def get_golden_response(prompt_type: str, user_input: str) -> str | None:
    """Get a cached golden response for a prompt type and input.

    Uses a simple key match — for production, consider fuzzy matching.
    """
    cases = load_golden_cases()
    type_cases = cases.get(prompt_type, [])
    for case in type_cases:
        if case.get("input", "").strip() == user_input.strip():
            return case.get("output", "")
    return None


# Predefined test inputs for each prompt type
PREDICTIVE_MAINTENANCE_INPUTS = [
    {
        "input": "Machine CAT-320 excavator, 4500 operating hours, hydraulic pressure dropping from 3500 PSI to 2800 PSI over last shift. Engine temperature normal at 92C. No unusual vibrations reported.",
        "context": [
            "CAT-320 maintenance manual: Hydraulic system service interval is 5000 hours or 12 months.",
            "Standard operating pressure for CAT-320 hydraulic system: 3500-4000 PSI.",
            "Hydraulic pressure drop > 15% from normal indicates potential pump wear or seal failure.",
        ],
    },
    {
        "input": "Sandvik DD422 drill rig, 12000 hours, drill penetration rate decreased 25% from baseline. Rod handling system intermittent delays. Coolant level stable.",
        "context": [
            "Sandvik DD422 service manual: Penetration rate drop >20% warrants immediate inspection.",
            "Rod handling delays typically indicate hydraulic valve issues or sensor misalignment.",
        ],
    },
]

SHIFT_HANDOFF_INPUTS = [
    {
        "input": "Day shift summary: 3 loads completed on excavator EX-01, 2 operational delays (weather 45min, equipment changeover 20min). Night shift should prioritize backlog clearing on Load 4.",
        "context": [
            "All machines reported operational at shift end.",
            "Weather forecast: clear skies expected for next 8 hours.",
        ],
    },
]

SAFETY_COMPLIANCE_INPUTS = [
    {
        "input": "Shift log: Worker observed standing on excavator tracks without fall protection at 14:30. Near-miss: drill rod dropped from 0.5m during rod change at 16:00, no injuries. PPE compliance: 98% hard hat, 95% safety glasses.",
        "context": [
            "Fall protection required when working at heights >1.2m per site policy MP-003.",
            "All near-misses must be reported within 24 hours per incident reporting procedure IR-001.",
        ],
    },
]

EQUIPMENT_MANUAL_INPUTS = [
    {
        "input": "What is the recommended hydraulic oil filter change interval for a CAT-320 excavator operating in dusty conditions?",
        "context": [
            "CAT-320 Operation and Maintenance Manual: Standard hydraulic filter interval is 1000 hours.",
            "In dusty/high-debris conditions, reduce interval to 500 hours.",
            "Use Cat HYDO Advanced 10 hydraulic oil only.",
        ],
    },
]

TRANSLATION_INPUTS = [
    {
        "input": "Translate to Afrikaans: 'All operators must complete the daily pre-shift inspection checklist before starting equipment.'",
        "context": [
            "Technical terminology reference: 'pre-shift inspection' = 'voorskof-inspeksie', 'checklist' = 'kontrolelys', 'equipment' = 'toerusting'.",
        ],
    },
]