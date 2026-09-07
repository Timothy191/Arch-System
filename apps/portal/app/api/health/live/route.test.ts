/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/health/live", () => {
  it("returns healthy liveness payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/health/live", {
      method: "GET",
    });

    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(typeof json.latencyMs).toBe("number");
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });
});
