import { ShiftReportWorkflow } from "./index.js";
import type { WorkflowEvent, WorkflowStep } from "../src/__mocks__/cloudflare-workers.js";

interface MockR2 {
  put: jest.Mock;
}

const buildR2Mock = (): MockR2 => ({
  put: jest.fn().mockResolvedValue(undefined),
});

const buildEnv = (bucket: MockR2) => ({
  // `cloudflare:workers` resolves to the Jest stub in this package, so the
  // test-only env shape is narrower than the runtime `Env` — we just need the
  // bindings the workflow actually reads.
  SHIFT_REPORT_WORKFLOW: {} as unknown as Env["SHIFT_REPORT_WORKFLOW"],
  SPATIAL_TELEMETRY_BUCKET: bucket as unknown as Env["SPATIAL_TELEMETRY_BUCKET"],
  ENVIRONMENT: "test",
  FUXA_SCADA_URL: "https://fuxa.test",
});

const buildStep = (): WorkflowStep => {
  const stub = {
    do: jest
      .fn<Promise<unknown>, [string, () => Promise<unknown>]>()
      .mockImplementation(async (_name, fn) => fn()),
  };
  // Cast through `unknown`: the production `WorkflowStep.do` is generic; the
  // stub re-declares a minimal surface area sufficient for unit tests.
  return stub as unknown as WorkflowStep;
};

const buildEvent = (
  payload: Parameters<typeof ShiftReportWorkflow.prototype.run>[0]["payload"],
): WorkflowEvent<typeof payload> =>
  ({
    payload,
    timestamp: new Date("2026-08-18T19:00:00Z"),
    instanceId: "test-instance",
  }) as unknown as WorkflowEvent<typeof payload>;

describe("ShiftReportWorkflow", () => {
  it("should process compliant shift reports successfully", async () => {
    const mockR2 = buildR2Mock();
    const env = buildEnv(mockR2);
    const workflow = new ShiftReportWorkflow(undefined, env);
    const step = buildStep();

    const event = buildEvent({
      department: "control-room",
      shiftId: "shift-test-1",
      operatorId: "op-101",
      timestamp: "2026-08-18T19:00:00Z",
      scadaAlarmsCount: 5,
      unacknowledgedAlarmsCount: 0,
      slaViolationCount: 0,
    });

    const result = await workflow.run(event, step);

    expect(result.status).toBe("COMPLETED");
    expect(result.reportKey).toBe("shift-reports/control-room/shift-test-1.json");
    expect(mockR2.put).toHaveBeenCalledWith(
      "shift-reports/control-room/shift-test-1.json",
      expect.any(String),
      expect.objectContaining({ httpMetadata: { contentType: "application/json" } }),
    );
  });

  it("should escalate shift reports with SLA violations", async () => {
    const mockR2 = buildR2Mock();
    const env = buildEnv(mockR2);
    const workflow = new ShiftReportWorkflow(undefined, env);
    const step = buildStep();

    const event = buildEvent({
      department: "control-room",
      shiftId: "shift-test-2",
      operatorId: "op-102",
      timestamp: "2026-08-18T19:00:00Z",
      scadaAlarmsCount: 8,
      unacknowledgedAlarmsCount: 2,
      slaViolationCount: 1,
    });

    const result = await workflow.run(event, step);

    expect(result.status).toBe("ESCALATED");
    expect(result.escalationId).toBeDefined();
    expect(mockR2.put).toHaveBeenCalled();
  });
});
