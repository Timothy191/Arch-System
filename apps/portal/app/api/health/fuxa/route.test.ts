/**
 * @jest-environment node
 */
import { GET } from "./route";

describe("GET /api/health/fuxa", () => {
  const originalEnv = process.env.NEXT_PUBLIC_FUXA_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_FUXA_URL = "http://localhost:1881";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FUXA_URL = originalEnv;
  });

  it("returns healthy when FUXA responds ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(typeof json.latency_ms).toBe("number");
    expect(new Date(json.last_check).getTime()).not.toBeNaN();
    expect(json.details.url).toBe("http://localhost:1881");
    expect(json.details.http_status).toBe(200);
    expect(json.details.error).toBeNull();
  });

  it("returns down when FUXA is unreachable", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("connection refused"));

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("down");
    expect(json.details.http_status).toBeNull();
    expect(json.details.error).toBe("connection refused");
  });
});
