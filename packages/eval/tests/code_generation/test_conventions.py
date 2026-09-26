"""Code generation compliance tests for Arch-Systems conventions.

These tests evaluate Claude's code output against project-specific rules.
They can be used by piping Claude's generated code into the test case.
"""

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase

from metrics.design_system_compliance import DesignSystemComplianceMetric
from metrics.supabase_import_compliance import SupabaseImportComplianceMetric
from metrics.rls_completeness import RLSCompletenessMetric
from metrics.department_pattern_compliance import DepartmentPatternComplianceMetric


# ============================================================
# Design System Compliance Tests
# ============================================================

DESIGN_SYSTEM_GOOD_CODE = """
import { GlassCard } from "@repo/ui/GlassCard";
import { KPIGrid, KPICard } from "@repo/ui/KPI";
import { cn } from "@repo/ui/lib/utils";

export default function Dashboard({ stats }) {
  return (
    <div className="space-y-6">
      <KPIGrid cols={4}>
        <KPICard label="Hours Today" value="24.5h" color="green" />
        <KPICard label="Delays" value={3} color="blue" sub="45 min lost" />
      </KPIGrid>
    </div>
  );
}
"""

DESIGN_SYSTEM_BAD_CODE = """
export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold shadow-lg">Dashboard</h1>
      <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
        <p className="text-white/50 text-white/70">Stats</p>
      </div>
    </div>
  );
}
"""


@pytest.mark.code_gen
class TestDesignSystemCompliance:
    """Test that generated code follows Arch-Systems design system rules."""

    def test_good_code_passes(self):
        """Correctly styled code should score well."""
        test_case = LLMTestCase(
            input="Generate a dashboard page with KPI cards",
            actual_output=DESIGN_SYSTEM_GOOD_CODE,
        )
        metric = DesignSystemComplianceMetric(minimum_score=0.7)
        assert_test(test_case, [metric])

    def test_bad_code_fails(self):
        """Code with forbidden patterns should score poorly."""
        test_case = LLMTestCase(
            input="Generate a dashboard page",
            actual_output=DESIGN_SYSTEM_BAD_CODE,
        )
        metric = DesignSystemComplianceMetric(minimum_score=0.7)
        # We expect this to fail — the code uses forbidden patterns
        metric.measure(test_case)
        assert metric.score < 0.7, f"Expected score < 0.7 for bad code, got {metric.score}"


# ============================================================
# Supabase Import Compliance Tests
# ============================================================

SUPABASE_GOOD_SERVER = """
import { createServerSupabaseClient } from "@repo/supabase/server";

export default async function Page() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("machines").select("*");
  return <div>{data?.length} machines</div>;
}
"""

SUPABASE_BAD_DIRECT = """
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
export default function Page() {
  const { data } = await supabase.from("machines").select("*");
  return <div>{data?.length} machines</div>;
}
"""


@pytest.mark.code_gen
class TestSupabaseImportCompliance:
    """Test that generated code uses correct Supabase import patterns."""

    def test_good_server_import(self):
        """Server component with correct import should pass."""
        test_case = LLMTestCase(
            input="Generate a server component that fetches machines",
            actual_output=SUPABASE_GOOD_SERVER,
        )
        metric = SupabaseImportComplianceMetric(minimum_score=0.8)
        assert_test(test_case, [metric])

    def test_bad_direct_import(self):
        """Direct @supabase/supabase-js import should fail."""
        test_case = LLMTestCase(
            input="Generate a component that fetches machines",
            actual_output=SUPABASE_BAD_DIRECT,
        )
        metric = SupabaseImportComplianceMetric(minimum_score=0.8)
        metric.measure(test_case)
        assert metric.score <= 0.5, f"Expected low score for direct import, got {metric.score}"


# ============================================================
# RLS Completeness Tests
# ============================================================

RLS_GOOD_MIGRATION = """
-- Create operational_delays table
CREATE TABLE IF NOT EXISTS public.operational_delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  delay_type TEXT NOT NULL,
  description TEXT,
  delay_minutes INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.operational_delays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operational_delays_select_department"
  ON public.operational_delays FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (e.role = 'admin' OR e.department_id = operational_delays.department_id
          OR operational_delays.department_id = ANY(e.accessible_departments))
    )
  );

CREATE POLICY "operational_delays_insert_department"
  ON public.operational_delays FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (e.role = 'admin' OR e.department_id = operational_delays.department_id
          OR operational_delays.department_id = ANY(e.accessible_departments))
    )
  );

CREATE POLICY "operational_delays_update_department"
  ON public.operational_delays FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (e.role = 'admin' OR e.department_id = operational_delays.department_id)
    )
  );

CREATE POLICY "operational_delays_delete_admin"
  ON public.operational_delays FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid() AND e.role = 'admin'
    )
  );

CREATE INDEX idx_operational_delays_department ON public.operational_delays(department_id);
CREATE INDEX idx_operational_delays_created_at ON public.operational_delays(created_at DESC);
"""

RLS_BAD_MIGRATION = """
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
"""


@pytest.mark.code_gen
class TestRLSCompleteness:
    """Test that generated SQL migrations have proper RLS policies."""

    def test_good_migration_passes(self):
        """Complete migration with RLS should pass."""
        test_case = LLMTestCase(
            input="Create a migration for operational_delays table with RLS policies",
            actual_output=RLS_GOOD_MIGRATION,
        )
        metric = RLSCompletenessMetric(minimum_score=0.8)
        assert_test(test_case, [metric])

    def test_bad_migration_fails(self):
        """Migration without RLS should fail."""
        test_case = LLMTestCase(
            input="Create a migration for reports table",
            actual_output=RLS_BAD_MIGRATION,
        )
        metric = RLSCompletenessMetric(minimum_score=0.8)
        metric.measure(test_case)
        assert metric.score < 0.5, f"Expected low score for migration without RLS, got {metric.score}"


# ============================================================
# Department Pattern Compliance Tests
# ============================================================

DEPT_GOOD_PAGE = """
import { getDepartmentContext, requireDepartment } from "~/lib/dept-context";
import { KPIGrid, KPICard } from "@repo/ui/KPI";
import { PageHeader } from "@repo/ui/PageHeader";

export default async function HourlyLoadsPage({ params }) {
  requireDepartment(params.department, "control-room");
  const { deptId, supabase, today } = await getDepartmentContext(params);

  const { data: loads } = await supabase
    .from("hourly_loads")
    .select("*")
    .eq("department_id", deptId)
    .eq("load_date", today);

  return (
    <div className="space-y-6">
      <PageHeader title="Hourly Loads" />
      <KPIGrid cols={3}>
        <KPICard label="Total Loads" value={1234} color="green" />
      </KPIGrid>
    </div>
  );
}
"""

DEPT_BAD_PAGE = """
import { createServerSupabaseClient } from "@repo/supabase/server";
import { DEPARTMENTS } from "~/lib/departments";
import { notFound } from "next/navigation";
import { GlassCard } from "@repo/ui/GlassCard";

export default async function Page({ params }) {
  const dept = DEPARTMENTS.find((d) => d.name === params.department);
  if (!dept) notFound();
  if (params.department !== "control-room") notFound();

  const supabase = await createServerSupabaseClient();
  const { data: department } = await supabase
    .from("departments").select("id").eq("name", params.department).single();
  if (!department) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-[#fafafa]">Hourly Loads</h2>
        <p className="text-[#898989] text-sm">{new Date().toLocaleDateString("en-ZA", { weekday: "long" })}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard><p className="text-[#898989] text-sm">Total</p><p className="text-2xl font-medium text-[#3ecf8e]">1234</p></GlassCard>
      </div>
    </div>
  );
}
"""


@pytest.mark.code_gen
class TestDepartmentPatternCompliance:
    """Test that generated department pages use shared utilities."""

    def test_good_page_passes(self):
        """Page using shared utilities should pass."""
        test_case = LLMTestCase(
            input="Generate a department page for hourly loads",
            actual_output=DEPT_GOOD_PAGE,
        )
        metric = DepartmentPatternComplianceMetric(minimum_score=0.7)
        assert_test(test_case, [metric])

    def test_bad_page_fails(self):
        """Page with inline patterns should score poorly."""
        test_case = LLMTestCase(
            input="Generate a department page",
            actual_output=DEPT_BAD_PAGE,
        )
        metric = DepartmentPatternComplianceMetric(minimum_score=0.7)
        metric.measure(test_case)
        assert metric.score < 0.7, f"Expected score < 0.7 for bad patterns, got {metric.score}"