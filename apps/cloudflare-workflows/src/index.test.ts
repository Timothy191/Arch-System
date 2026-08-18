import { ShiftReportWorkflow } from "./index.js";

describe("ShiftReportWorkflow", () => {
  it("should process compliant shift reports successfully", async () => {
    const mockR2 = {
      put: jest.fn().mockResolvedValue(undefined)
    };

    const env = {
      SHIFT_REPORT_WORKFLOW: {} as any,
      SPATIAL_TELEMETRY_BUCKET: mockR2 as any,
      FUXA_SCADA_URL: "https://fuxa.test",
      ENVIRONMENT: "test"
    };

    const workflow = new ShiftReportWorkflow({} as any, env);

    const step = {
      do: jest.fn().mockImplementation(async (name, fn) => fn())
    };

    const event = {
      payload: {
        department: "control-room",
        shiftId: "shift-test-1",
        operatorId: "op-101",
        timestamp: "2026-08-18T19:00:00Z",
        scadaAlarmsCount: 5,
        unacknowledgedAlarmsCount: 0,
        slaViolationCount: 0
      }
    };

    const result = await workflow.run(event as any, step as any);

    expect(result.status).toBe("COMPLETED");
    expect(result.reportKey).toBe("shift-reports/control-room/shift-test-1.json");
    expect(mockR2.put).toHaveBeenCalledWith(
      "shift-reports/control-room/shift-test-1.json",
      expect.any(String),
      expect.objectContaining({ httpMetadata: { contentType: "application/json" } })
    );
  });

  it("should escalate shift reports with SLA violations", async () => {
    const mockR2 = {
      put: jest.fn().mockResolvedValue(undefined)
    };

    const env = {
      SHIFT_REPORT_WORKFLOW: {} as any,
      SPATIAL_TELEMETRY_BUCKET: mockR2 as any,
      FUXA_SCADA_URL: "https://fuxa.test",
      ENVIRONMENT: "test"
    };

    const workflow = new ShiftReportWorkflow({} as any, env);

    const step = {
      do: jest.fn().mockImplementation(async (name, fn) => fn())
    };

    const event = {
      payload: {
        department: "control-room",
        shiftId: "shift-test-2",
        operatorId: "op-102",
        timestamp: "2026-08-18T19:00:00Z",
        scadaAlarmsCount: 8,
        unacknowledgedAlarmsCount: 2,
        slaViolationCount: 1
      }
    };

    const result = await workflow.run(event as any, step as any);

    expect(result.status).toBe("ESCALATED");
    expect(result.escalationId).toBeDefined();
    expect(mockR2.put).toHaveBeenCalled();
  });
});
