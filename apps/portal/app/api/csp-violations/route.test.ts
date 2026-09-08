/**
 * @jest-environment node
 */
import { POST } from "./route";

jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn(),
}));

const { logError } = jest.requireMock("@/lib/errors/error-logger") as {
  logError: jest.Mock;
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/csp-violations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/csp-violations", () => {
  beforeEach(() => {
    logError.mockClear();
  });

  it("returns 204 for a wrapped csp-report and logs the violation", async () => {
    const report = {
      "document-uri": "https://example.com",
      referrer: "https://example.com",
      "blocked-uri": "https://evil.example.com",
      "violated-directive": "script-src-elem",
      "effective-directive": "script-src-elem",
      "original-policy": "script-src-elem 'self'",
      disposition: "enforce",
      "status-code": 200,
      "source-file": "https://example.com/index.html",
      "line-number": 10,
      "column-number": 5,
    };

    const res = await POST(buildRequest({ "csp-report": report }));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: "csp_violation",
        directive: "script-src-elem",
        blockedUri: "https://evil.example.com",
        documentUri: "https://example.com",
        disposition: "enforce",
      })
    );
  });

  it("returns 204 for a camelCase cspReport wrapper and logs the violation", async () => {
    const report = {
      "document-uri": "https://example.com",
      referrer: "https://example.com",
      "blocked-uri": "https://evil.example.com",
      "violated-directive": "style-src",
      "effective-directive": "style-src",
      "original-policy": "style-src 'self'",
      disposition: "report",
      "status-code": 200,
    };

    const res = await POST(buildRequest({ cspReport: report }));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: "csp_violation",
        directive: "style-src",
        blockedUri: "https://evil.example.com",
        documentUri: "https://example.com",
        disposition: "report",
      })
    );
  });

  it("returns 204 without logging when no report is present", async () => {
    const res = await POST(buildRequest({ unrelated: true }));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(logError).not.toHaveBeenCalled();
  });

  it("returns 204 when the request body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/csp-violations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(logError).not.toHaveBeenCalled();
  });
});
