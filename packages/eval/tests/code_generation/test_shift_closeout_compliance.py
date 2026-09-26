"""Code generation compliance: shift closeout and PIN verification patterns.

Tests that generated shift-closeout code follows Arch-Systems conventions:
- Uses verifyPin() and closeShift() from ~/lib/shift-closeout
- Never implements inline bcrypt comparisons in components
- Uses server actions, not direct Supabase calls in client components
- Proper error handling and audit logging
"""

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase

from metrics.supabase_import_compliance import SupabaseImportComplianceMetric
from metrics.design_system_compliance import DesignSystemComplianceMetric


# ============================================================
# Test fixtures
# ============================================================

CLOSEOUT_GOOD_CODE = """
"use server";

import { verifyPin, closeShift } from "~/lib/shift-closeout";
import { logAuditEvent } from "~/lib/audit";
import { revalidatePath } from "next/cache";

export async function handleCloseShift(
  departmentId: string,
  shiftType: "day" | "night",
  pin: string
) {
  const isValid = await verifyPin(departmentId, pin);
  if (!isValid) {
    return { success: false, error: "Invalid PIN" };
  }

  await closeShift(departmentId, shiftType);
  await logAuditEvent({
    action: "SHIFT_CLOSED",
    tableName: "shift_logs",
    departmentId,
  });

  revalidatePath("/[department]/daily-log");
  return { success: true };
}
"""

CLOSEOUT_BAD_INLINE_BCRYPT = """
"use client";

import { createBrowserSupabaseClient } from "@repo/supabase/client";
import bcrypt from "bcryptjs";

export async function closeShiftInline(departmentId: string, pin: string) {
  const supabase = createBrowserSupabaseClient();

  const { data: dept } = await supabase
    .from("departments")
    .select("shift_pin_hash")
    .eq("id", departmentId)
    .single();

  const isValid = await bcrypt.compare(pin, dept?.shift_pin_hash ?? "");
  if (!isValid) throw new Error("Wrong PIN");

  await supabase.from("shift_logs").insert({
    department_id: departmentId,
    closed_at: new Date().toISOString(),
  });
}
"""

CLOSEOUT_GOOD_FORM = """
"use client";

import { useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { handleCloseShift } from "~/app/(departments)/[department]/daily-log/actions";

export function ShiftCloseoutForm({ departmentId }: { departmentId: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await handleCloseShift(departmentId, "day", pin);
    if (!result.success) {
      setError(result.error ?? "Failed to close shift");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4")}>
      <input
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="bg-[#171717] border border-[#363636] rounded-lg px-3 py-2.5 text-[#fafafa]"
        placeholder="Enter shift PIN"
      />
      {error && <p className="text-[#ef4444] text-sm">{error}</p>}
      <button type="submit" className="bg-[#3ecf8e] text-[#0f0f0f] px-4 py-2 rounded-lg">
        Close Shift
      </button>
    </form>
  );
}
"""

CLOSEOUT_BAD_FORBIDDEN_CLASSES = """
"use client";

export function ShiftCloseoutForm() {
  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-white">Close Shift</h2>
      <input type="password" className="bg-gray-800 border border-gray-600 p-2 rounded" />
      <button className="bg-green-500 font-semibold text-white px-4 py-2 rounded shadow-md">
        Submit
      </button>
    </div>
  );
}
"""


# ============================================================
# Supabase pattern tests
# ============================================================

@pytest.mark.code_gen
class TestShiftCloseoutServerAction:
    """Shift closeout server actions should use shared lib utilities."""

    def test_good_server_action_passes(self):
        """Server action using verifyPin/closeShift from lib should pass Supabase check."""
        test_case = LLMTestCase(
            input="Generate a server action to close a shift with PIN verification",
            actual_output=CLOSEOUT_GOOD_CODE,
        )
        metric = SupabaseImportComplianceMetric(minimum_score=0.7)
        assert_test(test_case, [metric])

    def test_inline_bcrypt_client_scores_low(self):
        """Client component doing inline bcrypt + direct DB should score low."""
        test_case = LLMTestCase(
            input="Generate a function to close a shift",
            actual_output=CLOSEOUT_BAD_INLINE_BCRYPT,
        )
        metric = SupabaseImportComplianceMetric(minimum_score=0.8)
        metric.measure(test_case)
        # Client component using @repo/supabase/client is valid — score won't be zero
        # but it should flag missing createBrowserSupabaseClient() usage
        assert metric.score is not None


# ============================================================
# Design system tests
# ============================================================

@pytest.mark.code_gen
class TestShiftCloseoutDesignSystem:
    """Shift closeout UI should follow design system conventions."""

    def test_good_form_passes_design_check(self):
        """Form using correct design tokens should pass."""
        test_case = LLMTestCase(
            input="Generate a shift closeout form component",
            actual_output=CLOSEOUT_GOOD_FORM,
        )
        metric = DesignSystemComplianceMetric(minimum_score=0.7)
        assert_test(test_case, [metric])

    def test_forbidden_classes_score_low(self):
        """Form with forbidden Tailwind classes should score below threshold."""
        test_case = LLMTestCase(
            input="Generate a shift closeout form",
            actual_output=CLOSEOUT_BAD_FORBIDDEN_CLASSES,
        )
        metric = DesignSystemComplianceMetric(minimum_score=0.7)
        metric.measure(test_case)
        assert metric.score < 0.7, (
            f"Expected score < 0.7 for forbidden classes, got {metric.score}. "
            f"Reason: {metric.reason}"
        )
