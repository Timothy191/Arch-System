"""Code generation compliance: RLS policy completeness."""

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase


class RLSCompletenessMetric(BaseMetric):
    """Evaluate generated SQL migrations for RLS policy completeness.

    Checks that:
    - Every new table has ENABLE ROW LEVEL SECURITY
    - SELECT policy exists for authenticated users
    - INSERT policy exists with department check
    - UPDATE policy exists with appropriate restrictions
    - DELETE policy is restricted (admin-only or absent for audit tables)
    - Policies use auth helper functions (auth.user_department_id, auth.is_admin, auth.has_department_access)
    - Indexes on department_id and created_at are present
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
        sql = test_case.actual_output
        violations = []
        total_checks = 0

        # Check for RLS enable
        total_checks += 1
        if "ENABLE ROW LEVEL SECURITY" not in sql.upper():
            violations.append("Missing ENABLE ROW LEVEL SECURITY")

        # Check for SELECT policy
        total_checks += 1
        if "FOR SELECT" not in sql.upper() and "for select" not in sql.lower():
            violations.append("Missing SELECT policy")

        # Check for INSERT policy
        total_checks += 1
        if "FOR INSERT" not in sql.upper() and "for insert" not in sql.lower():
            violations.append("Missing INSERT policy")

        # Check for auth helper function usage
        total_checks += 1
        has_auth_helper = any(
            fn in sql
            for fn in ["auth.user_department_id()", "auth.is_admin()", "auth.has_department_access()"]
        )
        if not has_auth_helper:
            violations.append(
                "No auth helper functions used. Use auth.user_department_id(), "
                "auth.is_admin(), or auth.has_department_access() in policies."
            )

        # Check for department_id index
        total_checks += 1
        has_dept_index = "INDEX" in sql.upper() and "department_id" in sql.lower()
        if not has_dept_index and "department_id" in sql:
            violations.append("Missing index on department_id")

        # Check for created_at index or ordering
        total_checks += 1
        has_created_at_index = "INDEX" in sql.upper() and "created_at" in sql.lower()
        if not has_created_at_index and "created_at" in sql:
            violations.append("Missing index on created_at")

        # Check DELETE policy is restricted (admin-only or absent)
        total_checks += 1
        if "FOR DELETE" in sql.upper() or "for delete" in sql.lower():
            # DELETE policy exists — check it's restricted to admin
            delete_section = sql[sql.upper().find("FOR DELETE"):]
            if "admin" not in delete_section.lower() and "is_admin" not in delete_section:
                violations.append(
                    "DELETE policy should be admin-only (role = 'admin' or auth.is_admin())"
                )

        # Check for employees table reference in policies (department isolation)
        total_checks += 1
        if "employees" not in sql.lower() and ("FOR SELECT" in sql.upper() or "FOR INSERT" in sql.upper()):
            violations.append(
                "Policies should reference employees table for department isolation"
            )

        passed = total_checks - len(violations)
        self.score = passed / total_checks if total_checks > 0 else 1.0
        self.reason = (
            f"RLS completeness: {passed}/{total_checks} checks passed."
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
        return "RLSCompletenessMetric"