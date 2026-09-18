import { ApiGateway } from "../api-gateway";

describe("ApiGateway Framework Unit Tests", () => {
  it("should handle request, inject correlation ID header, and execute middleware pipeline", async () => {
    const gateway = new ApiGateway();

    const middlewareLog: string[] = [];
    gateway.use(async (_req, next) => {
      middlewareLog.push("m1-start");
      const res = await next();
      middlewareLog.push("m1-end");
      return res;
    });

    gateway.registerRoute({
      method: "GET",
      path: "/api/v1/health",
      handler: async (_req) => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: { status: "healthy" },
      }),
    });

    const response = await gateway.handleRequest({
      method: "GET",
      path: "/api/v1/health",
      headers: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: "healthy" });
    expect(response.headers["x-correlation-id"]).toBeDefined();
    expect(middlewareLog).toEqual(["m1-start", "m1-end"]);
  });

  it("should return HTTP 404 for unregistered routes", async () => {
    const gateway = new ApiGateway();

    const response = await gateway.handleRequest({
      method: "POST",
      path: "/api/unknown",
      headers: {},
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      code: "ROUTE_NOT_FOUND",
    });
  });
});
