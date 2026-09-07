/**
 * @jest-environment node
 */

import { GET, POST, PUT } from "./route";
import { NextRequest } from "next/server";

function buildRequest(method: "GET" | "POST" | "PUT", url = "http://localhost:3000/api/inngest") {
  return new NextRequest(url, { method, headers: { accept: "application/json" } });
}

describe("app/api/inngest/route", () => {
  it("exports GET, POST, and PUT handlers", () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
    expect(typeof PUT).toBe("function");
  });

  describe("GET", () => {
    it("responds without throwing", async () => {
      const response = await GET(buildRequest("GET"));
      expect(response).toBeDefined();
      expect(typeof response.status).toBe("number");
    });
  });

  describe("POST", () => {
    it("responds without throwing", async () => {
      const response = await POST(buildRequest("POST"));
      expect(response).toBeDefined();
      expect(typeof response.status).toBe("number");
    });
  });

  describe("PUT", () => {
    it("responds without throwing", async () => {
      const response = await PUT(buildRequest("PUT"));
      expect(response).toBeDefined();
      expect(typeof response.status).toBe("number");
    });
  });
});
