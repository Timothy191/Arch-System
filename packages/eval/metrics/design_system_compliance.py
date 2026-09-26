"""Code generation compliance: design system rules."""

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase


class DesignSystemComplianceMetric(BaseMetric):
    """Evaluate generated code against Arch-Systems design system rules.

    Checks for:
    - No forbidden patterns (font-bold, font-semibold, shadow-*, bg-white/5, etc.)
    - Uses design token colors (#0f0f0f, #171717, #3ecf8e, etc.)
    - Uses cn() from @repo/ui/lib/utils for class merging
    - Uses GlassCard for card containers
    """

    def __init__(self, minimum_score: float = 0.8):
        self.minimum_score = minimum_score
        self.threshold = minimum_score
        self.async_mode = False
        self.evaluation_model = "custom"
        self.evaluation_cost = 0.0
        self.verbose_logs = None
        self.strict_mode = False
        self.score = None
        self.reason = None
        self.success = None
        self.error = None

    def measure(self, test_case: LLMTestCase) -> float:
        code = test_case.actual_output
        violations = []
        total_checks = 0

        # Forbidden patterns
        forbidden = [
            ("font-bold", "Use font-medium instead of font-bold"),
            ("font-semibold", "Use font-medium instead of font-semibold"),
            ("shadow-", "Use border for depth, not box-shadow"),
            ("bg-white/5", "Use design token bg-[#242424]"),
            ("border-white/10", "Use design token border-[#363636]"),
            ("text-white/50", "Use design token text-[#898989]"),
            ("text-white/70", "Use design token text-[#b4b4b4]"),
        ]

        for pattern, reason in forbidden:
            total_checks += 1
            if pattern in code:
                violations.append(f"Forbidden pattern '{pattern}': {reason}")

        # Check design token usage
        total_checks += 1
        has_token_colors = any(
            token in code
            for token in ["#0f0f0f", "#171717", "#242424", "#3ecf8e", "#fafafa", "#898989"]
        )
        if not has_token_colors and ("bg-" in code or "text-" in code or "border-" in code):
            violations.append("No design token colors found in styled elements")

        # Check cn() usage for class merging
        total_checks += 1
        if "className" in code and "cn(" not in code and ("${" in code or "?" in code.split("className")[0] if "className" in code else False):
            # Only flag if there's conditional class logic without cn()
            if any(x in code for x in ["? ", ": "]):
                violations.append("Conditional className should use cn() from @repo/ui/lib/utils")

        # Check GlassCard usage for card containers
        total_checks += 1
        if "border border-[#" in code and "GlassCard" not in code:
            # If they're creating card-like containers manually
            if "rounded" in code and "p-6" in code:
                violations.append("Card containers should use GlassCard from @repo/ui/GlassCard")

        passed = total_checks - len(violations)
        self.score = passed / total_checks if total_checks > 0 else 1.0
        self.reason = (
            f"Design system compliance: {passed}/{total_checks} checks passed."
            + (f" Violations: {'; '.join(violations)}" if violations else "")
        )
        self.success = self.score >= self.minimum_score

        return self.score

    async def a_measure(self, test_case: LLMTestCase, *args, **kwargs) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return self.success

    @property
    def __name__(self):
        return "DesignSystemComplianceMetric"