"""Code generation compliance: Supabase import patterns."""

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase


class SupabaseImportComplianceMetric(BaseMetric):
    """Evaluate generated code for correct Supabase import patterns.

    Checks that:
    - Server components import from @repo/supabase/server
    - Client components import from @repo/supabase/client
    - Middleware imports from @repo/supabase/middleware
    - Never imports directly from @supabase/supabase-js
    - Uses createServerSupabaseClient() in server components
    - Uses createBrowserSupabaseClient() in client components
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

        # Check for direct @supabase/supabase-js import (FORBIDDEN)
        total_checks += 1
        if "@supabase/supabase-js" in code:
            violations.append(
                "FORBIDDEN: Direct import from @supabase/supabase-js. "
                "Use @repo/supabase/server, @repo/supabase/client, or @repo/supabase/middleware."
            )

        # Determine if this is a server or client component
        is_server = '"use server"' in code or "createServerSupabaseClient" in code
        is_client = '"use client"' in code or "createBrowserSupabaseClient" in code

        # Check server component uses correct import
        if is_server:
            total_checks += 1
            if "@repo/supabase/server" not in code:
                violations.append(
                    "Server component should import from @repo/supabase/server"
                )

            total_checks += 1
            if "createServerSupabaseClient" not in code and "supabase" in code.lower():
                violations.append(
                    "Server component should use createServerSupabaseClient()"
                )

        # Check client component uses correct import
        if is_client:
            total_checks += 1
            if "@repo/supabase/client" not in code:
                violations.append(
                    "Client component should import from @repo/supabase/client"
                )

            total_checks += 1
            if "createBrowserSupabaseClient" not in code and "supabase" in code.lower():
                violations.append(
                    "Client component should use createBrowserSupabaseClient()"
                )

        # Check that service key is never in client code
        total_checks += 1
        if "SUPABASE_SERVICE_KEY" in code or "service_role" in code:
            if is_client or "NEXT_PUBLIC" not in code.split("SUPABASE_SERVICE_KEY")[0] if "SUPABASE_SERVICE_KEY" in code else True:
                violations.append(
                    "FORBIDDEN: Service key should never appear in client-side code"
                )

        passed = total_checks - len(violations)
        self.score = passed / total_checks if total_checks > 0 else 1.0
        self.reason = (
            f"Supabase import compliance: {passed}/{total_checks} checks passed."
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
        return "SupabaseImportComplianceMetric"