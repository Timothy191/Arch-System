import { riskAssessmentSchema, complianceResultSchema } from "@repo/contract";

describe("riskAssessmentSchema", () => {
  it("accepts valid low-risk assessment", () => {
    const result = riskAssessmentSchema.safeParse({
      risk: "low",
      actions: ["Monitor daily"],
      timeEstimate: "1 day",
      summary: "No immediate action required.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all risk levels", () => {
    for (const risk of ["low", "medium", "high"] as const) {
      const result = riskAssessmentSchema.safeParse({
        risk,
        actions: [],
        timeEstimate: "2h",
        summary: "ok",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown risk level", () => {
    const result = riskAssessmentSchema.safeParse({
      risk: "critical",
      actions: [],
      timeEstimate: "1h",
      summary: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(riskAssessmentSchema.safeParse({ risk: "low" }).success).toBe(false);
    expect(riskAssessmentSchema.safeParse({}).success).toBe(false);
  });

  it("accepts empty actions array", () => {
    const result = riskAssessmentSchema.safeParse({
      risk: "medium",
      actions: [],
      timeEstimate: "4h",
      summary: "Reviewing situation.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple action strings", () => {
    const result = riskAssessmentSchema.safeParse({
      risk: "high",
      actions: ["Evacuate pit wall", "Notify engineer", "Log incident"],
      timeEstimate: "Immediate",
      summary: "Critical deformation detected.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actions).toHaveLength(3);
    }
  });
});

describe("complianceResultSchema", () => {
  it("accepts valid compliance result", () => {
    const result = complianceResultSchema.safeParse({
      violations: [],
      concerns: ["Outdated safety briefing"],
      score: 8,
      summary: "Generally compliant.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects score below 1", () => {
    const result = complianceResultSchema.safeParse({
      violations: [],
      concerns: [],
      score: 0,
      summary: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects score above 10", () => {
    const result = complianceResultSchema.safeParse({
      violations: [],
      concerns: [],
      score: 11,
      summary: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary scores 1 and 10", () => {
    for (const score of [1, 10]) {
      const result = complianceResultSchema.safeParse({
        violations: [],
        concerns: [],
        score,
        summary: "ok",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts violations and concerns as string arrays", () => {
    const result = complianceResultSchema.safeParse({
      violations: ["PPE not worn", "No spotter"],
      concerns: ["Worn tread on tyres"],
      score: 4,
      summary: "Multiple violations found.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.violations).toHaveLength(2);
    }
  });

  it("rejects missing score field", () => {
    const result = complianceResultSchema.safeParse({
      violations: [],
      concerns: [],
      summary: "incomplete",
    });
    expect(result.success).toBe(false);
  });
});
