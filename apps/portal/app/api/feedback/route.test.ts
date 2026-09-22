/**
 * @jest-environment node
 */

import { POST } from "./route";

jest.mock("@repo/logger", () => ({
  serverLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { serverLogger } = jest.requireMock("@repo/logger") as {
  serverLogger: { info: jest.Mock; error: jest.Mock };
};

function buildRequest(body: unknown) {
  return new Request("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with success payload for valid feedback", async () => {
    const response = await POST(
      buildRequest({
        type: "bug",
        message: "Something broke",
        userEmail: "user@example.com",
        metadata: { browser: "chrome" },
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true, ticketId: "TKT-1234" });
    expect(serverLogger.info).toHaveBeenCalledWith(
      { userEmail: "user@example.com", metadata: { browser: "chrome" } },
      "[FEEDBACK] Type: bug - Something broke",
    );
    expect(serverLogger.error).not.toHaveBeenCalled();
  });

  it("returns 500 when request body is invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ success: false });
    expect(serverLogger.error).toHaveBeenCalled();
  });

  it("returns 500 when an unexpected runtime error occurs", async () => {
    const response = await POST(
      new Proxy(
        buildRequest({
          type: "bug",
          message: "boom",
          userEmail: "user@example.com",
          metadata: {},
        }),
        {
          get(target, property) {
            if (property === "json") {
              return () => {
                throw new Error("unexpected");
              };
            }
            return (target as unknown as Record<string, unknown>)[property];
          },
        } as unknown as Request,
      ),
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ success: false });
    expect(serverLogger.error).toHaveBeenCalled();
  });
});
