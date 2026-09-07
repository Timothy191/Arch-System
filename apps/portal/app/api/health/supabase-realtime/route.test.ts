/**
 * @jest-environment node
 */
import { GET } from "./route";

describe("GET /api/health/supabase-realtime", () => {
  it("returns healthy supabase realtime payload", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(typeof json.latencyMs).toBe("number");
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });
});
