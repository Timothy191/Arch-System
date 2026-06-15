"""Code generation compliance: department pattern usage."""

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase


class DepartmentPatternComplianceMetric(BaseMetric):
    """Evaluate generated code for correct use of shared department utilities.

    Checks that:
    - Department page components use getDepartmentContext() for lookup
    - Restricted pages use requireDepartment() guard
    - KPI summaries use KPIGrid/KPICard from @repo/ui/KPI
    - Page headers use PageHeader from @repo/ui/PageHeader
    - Form select/textarea use FormFields components from @repo/ui/FormFields
    - Shift toggles use ShiftToggle from @repo/ui/ShiftToggle
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

        is_department_page = (
            "params.department" in code
            or "DEPARTMENTS" in code
            or "department_id" in code
        )

        if not is_department_page:
            # Not a department page — skip all checks
            self.score = 1.0
            self.reason = "Not a department page — all checks skipped."
            self.success = True
            return self.score

        # Check for getDepartmentContext usage
        total_checks += 1
        if "createServerSupabaseClient" in code and "DEPARTMENTS.find" in code:
            if "getDepartmentContext" not in code:
                violations.append(
                    "Department pages should use getDepartmentContext() from ~/lib/dept-context "
                    "instead of manually looking up department and creating supabase client"
                )

        # Check for requireDepartment usage on restricted pages
        total_checks += 1
        if "params.department !==" in code or "params.department ==" in code:
            if "requireDepartment" not in code and "notFound()" in code:
                violations.append(
                    "Use requireDepartment() from ~/lib/dept-context instead of "
                    "inline department checks with notFound()"
                )

        # Check for KPI card usage
        total_checks += 1
        if any(pattern in code for pattern in ["text-2xl font-medium", "text-2xl font-semibold", "text-[#898989] text-xs uppercase"]):
            if "KPICard" not in code and "KPIGrid" not in code:
                violations.append(
                    "KPI summary cards should use KPICard/KPIGrid from @repo/ui/KPI "
                    "instead of manual GlassCard + text patterns"
                )

        # Check for PageHeader usage
        total_checks += 1
        if "flex items-center justify-between" in code and "text-2xl" in code and "toLocaleDateString" in code:
            if "PageHeader" not in code:
                violations.append(
                    "Page headers with title + date should use PageHeader from @repo/ui/PageHeader"
                )

        # Check for form field patterns
        total_checks += 1
        if "bg-[#171717] border border-[#363636] rounded-lg px-3 py-2.5" in code:
            # Count occurrences of this pattern — if more than 2, suggest FormFields
            pattern_count = code.count("bg-[#171717] border border-[#363636] rounded-lg px-3 py-2.5")
            if pattern_count > 2 and "FormSelect" not in code and "FormInput" not in code:
                violations.append(
                    f"Found {pattern_count} instances of inline form field styling. "
                    "Consider using FormInput/FormSelect/FormTextarea from @repo/ui/FormFields"
                )

        # Check for shift toggle pattern
        total_checks += 1
        if '"day"' in code and '"night"' in code and "getCurrentShift" in code:
            if "ShiftToggle" not in code:
                violations.append(
                    "Day/night shift toggle should use ShiftToggle from @repo/ui/ShiftToggle "
                    "and getCurrentShift() helper"
                )

        passed = total_checks - len(violations)
        self.score = passed / total_checks if total_checks > 0 else 1.0
        self.reason = (
            f"Department pattern compliance: {passed}/{total_checks} checks passed."
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
        return "DepartmentPatternComplianceMetric"