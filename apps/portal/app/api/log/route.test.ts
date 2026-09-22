/**
 * @jest-environment node
 */
import { POST } from "./route";

jest.mock("@repo/logger", () => ({
  serverLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const { serverLogger } = jest.requireMock("@repo/logger");

function buildRequest(body: unknown): Request {
  return {
    json: async () => body,
  } as unknown as Request;
}

describe("POST /api/log", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs an error and returns success", async () => {
    const req = buildRequest({
      level: "error",
      msg: "boom",
      timestamp: "2026-09-07T00:00:00.000Z",
      data: { foo: 1 },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(serverLogger.error).toHaveBeenCalledWith(
      { clientTimestamp: "2026-09-07T00:00:00.000Z", foo: 1 },
      "[CLIENT] boom",
    );
  });

  it("logs a warning and returns success", async () => {
    const req = buildRequest({
      level: "warn",
      msg: "heads up",
      timestamp: "2026-09-07T00:00:00.000Z",
      data: { bar: 2 },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(serverLogger.warn).toHaveBeenCalledWith(
      { clientTimestamp: "2026-09-07T00:00:00.000Z", bar: 2 },
      "[CLIENT] heads up",
    );
  });

  it("logs info and returns success", async () => {
    const req = buildRequest({
      level: "info",
      msg: "note",
      timestamp: "2026-09-07T00:00:00.000Z",
      data: { baz: 3 },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(serverLogger.info).toHaveBeenCalledWith(
      { clientTimestamp: "2026-09-07T00:00:00.000Z", baz: 3 },
      "[CLIENT] note",
    );
  });

  it("falls back to debug for unknown levels and returns success", async () => {
    const req = buildRequest({
      level: "unknown",
      msg: "fallback",
      timestamp: "2026-09-07T00:00:00.000Z",
      data: { qux: 4 },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(serverLogger.debug).toHaveBeenCalledWith(
      { clientTimestamp: "2026-09-07T00:00:00.000Z", qux: 4 },
      "[CLIENT] fallback",
    );
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const req = {
      json: async () => {
        throw new Error("invalid json");
      },
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false });
    expect(serverLogger.error).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      "Failed to parse client log payload",
    );
  });
});
