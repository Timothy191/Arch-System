import { classifyReconciliationDrift, RECONCILIATION_UI } from "./production-reconciliation";

describe("classifyReconciliationDrift", () => {
  it("returns 'stable' for drift below the minor threshold", () => {
    expect(classifyReconciliationDrift(0)).toBe("stable");
    expect(classifyReconciliationDrift(4.99)).toBe("stable");
  });

  it("returns 'minor' at the 5% threshold and below 10%", () => {
    expect(classifyReconciliationDrift(5)).toBe("minor");
    expect(classifyReconciliationDrift(9.99)).toBe("minor");
  });

  it("returns 'moderate' at the 10% threshold and below 15%", () => {
    expect(classifyReconciliationDrift(10)).toBe("moderate");
    expect(classifyReconciliationDrift(14.99)).toBe("moderate");
  });

  it("returns 'critical' at the 15% threshold and above", () => {
    expect(classifyReconciliationDrift(15)).toBe("critical");
    expect(classifyReconciliationDrift(42)).toBe("critical");
  });

  it("treats negative drift as its absolute value", () => {
    expect(classifyReconciliationDrift(-4.99)).toBe("stable");
    expect(classifyReconciliationDrift(-6)).toBe("minor");
    expect(classifyReconciliationDrift(-12)).toBe("moderate");
    expect(classifyReconciliationDrift(-20)).toBe("critical");
  });

  it("treats NaN as stable (all comparisons fail)", () => {
    expect(classifyReconciliationDrift(NaN)).toBe("stable");
  });
});

describe("RECONCILIATION_UI", () => {
  it("provides metadata for every drift level", () => {
    const levels = ["stable", "minor", "moderate", "critical"] as const;
    for (const level of levels) {
      const meta = RECONCILIATION_UI[level];
      expect(meta).toBeDefined();
      expect(meta.color).toEqual(expect.any(String));
      expect(meta.label).toEqual(expect.any(String));
      expect(meta.description).toEqual(expect.any(String));
    }
  });

  it("maps stable to the emerald/optimal presentation", () => {
    expect(RECONCILIATION_UI.stable).toEqual({
      color: "emerald",
      label: "Optimal",
      description: expect.stringContaining("±5%"),
    });
  });
});
