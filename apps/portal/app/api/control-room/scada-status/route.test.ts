/**
 * @jest-environment node
 */
import { GET } from "./route";

jest.mock("@repo/redis", () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    keys: jest.fn().mockResolvedValue(["telemetry:last:tag1", "telemetry:last:tag2"]),
  }),
}));

describe("GET /api/control-room/scada-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns degraded status when FUXA SCADA is unreachable but Redis is connected", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused"));

    const req = new Request("http://localhost:3000/api/control-room/scada-status");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.fuxa_healthy).toBe(false);
    expect(json.redis_connected).toBe(true);
    expect(json.cached_tag_count).toBe(2);
  });

  it("returns healthy status when FUXA SCADA responds ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const req = new Request("http://localhost:3000/api/control-room/scada-status");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.fuxa_healthy).toBe(true);
    expect(json.redis_connected).toBe(true);
  });
});
