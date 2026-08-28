/**
 * @jest-environment node
 */
import { GET } from "./route";

// Define the mock functions INSIDE the factory to avoid jest.mock hoisting TDZ.
jest.mock("@repo/redis", () => {
  const keys = jest.fn();
  const mGet = jest.fn();
  return {
    getRedisClient: jest.fn().mockResolvedValue({ keys, mGet }),
  };
});

interface MockClient {
  keys: jest.Mock;
  mGet: jest.Mock;
}
function getRedisMock(): { getRedisClient: jest.Mock } {
  return jest.requireMock("@repo/redis") as unknown as { getRedisClient: jest.Mock };
}
async function client(): Promise<MockClient> {
  return (await getRedisMock().getRedisClient()) as MockClient;
}

describe("GET /api/scada/tags (FUXA WebAPI source, reverse-flow)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const c = await client();
    c.keys.mockReset();
    c.mGet.mockReset();
  });

  it("returns FUXA WebAPI-shaped tag array from the Redis telemetry cache", async () => {
    const c = await client();
    c.keys.mockResolvedValueOnce([
      "telemetry:last:machine_1_engine_rpm",
      "telemetry:last:machine_2_engine_temp",
    ]);
    c.mGet.mockResolvedValueOnce(["1500", "92.4"]);

    const req = new Request("http://localhost:3000/api/scada/tags");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual([
      { id: "machine_1_engine_rpm", name: "machine_1_engine_rpm", value: 1500, type: "number" },
      { id: "machine_2_engine_temp", name: "machine_2_engine_temp", value: 92.4, type: "number" },
    ]);
    expect(c.keys).toHaveBeenCalledWith("telemetry:last:*");
    expect(c.mGet).toHaveBeenCalledWith([
      "telemetry:last:machine_1_engine_rpm",
      "telemetry:last:machine_2_engine_temp",
    ]);
  });

  it("returns an empty array when the cache has no telemetry keys", async () => {
    const c = await client();
    c.keys.mockResolvedValueOnce([]);

    const req = new Request("http://localhost:3000/api/scada/tags");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(c.mGet).not.toHaveBeenCalled();
  });

  it("falls back to string type for non-numeric cached values", async () => {
    const c = await client();
    c.keys.mockResolvedValueOnce(["telemetry:last:machine_1_status"]);
    c.mGet.mockResolvedValueOnce(["RUNNING"]);

    const req = new Request("http://localhost:3000/api/scada/tags");
    const res = await GET(req);
    const json = await res.json();
    expect(json[0]).toEqual({
      id: "machine_1_status",
      name: "machine_1_status",
      value: "RUNNING",
      type: "string",
    });
  });

  it("returns 500 when Redis is unavailable", async () => {
    const redisMock = getRedisMock();
    redisMock.getRedisClient.mockRejectedValueOnce(new Error("Redis down"));

    const req = new Request("http://localhost:3000/api/scada/tags");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Redis down");
  });
});
