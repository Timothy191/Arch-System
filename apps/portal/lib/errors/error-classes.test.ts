import {
  APIError,
  AuthError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  isAppError,
  isAuthError,
  isNotFoundError,
  isValidationError,
} from "./error-classes";

describe("AppError (base class behavior via subclasses)", () => {
  it("sets the error name to the concrete subclass name", () => {
    expect(new DatabaseError("boom").name).toBe("DatabaseError");
    expect(new NotFoundError("missing").name).toBe("NotFoundError");
  });

  it("propagates context and cause passed through subclass options", () => {
    const cause = new Error("root cause");
    const err = new DatabaseError("boom", { context: { table: "machines" }, cause });
    expect(err.context).toEqual({ table: "machines" });
    expect(err.cause).toBe(cause);
  });
});

describe("APIError", () => {
  it("captures the response status when constructed with a Response", () => {
    const err = new APIError("upstream failed", new Response(null, { status: 503 }));
    expect(err.code).toBe("API_ERROR");
    expect(err.statusCode).toBe(503);
    expect(err.response).toBeInstanceOf(Response);
  });

  it("defaults to 500 when no status is provided", () => {
    const err = new APIError("upstream failed");
    expect(err.code).toBe("API_ERROR");
    expect(err.statusCode).toBe(500);
  });

  it("merges extra option fields into context", () => {
    const err = new APIError("bad gateway", {
      statusCode: 502,
      context: { origin: "worker" },
      requestId: "req-123",
    });
    expect(err.statusCode).toBe(502);
    expect(err.context).toEqual({ origin: "worker", requestId: "req-123" });
  });

  it("keeps context and cause as own properties when supplied", () => {
    const cause = new Error("c");
    const err = new APIError("bad gateway", { statusCode: 502, context: { a: 1 }, cause });
    expect(err.context).toEqual({ a: 1 });
    expect(err.cause).toBe(cause);
  });
});

describe("ValidationError", () => {
  it("uses VALIDATION_ERROR code and 400 status", () => {
    const err = new ValidationError("bad input");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
  });

  it("places field and value into context", () => {
    const err = new ValidationError("bad input", { field: "email", value: "nope" });
    expect(err.context).toMatchObject({ field: "email", value: "nope" });
  });

  it("merges arbitrary extra options into context", () => {
    const err = new ValidationError("bad input", { field: "email", constraint: "email-format" });
    expect(err.context).toMatchObject({ field: "email", constraint: "email-format" });
  });
});

describe("named error subclasses", () => {
  it("AuthError defaults message, code, and 401 status", () => {
    const err = new AuthError();
    expect(err.message).toBe("Authentication failed");
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.statusCode).toBe(401);
  });

  it("DatabaseError uses DATABASE_ERROR and 500", () => {
    const err = new DatabaseError("write failed");
    expect(err.code).toBe("DATABASE_ERROR");
    expect(err.statusCode).toBe(500);
  });

  it("NotFoundError uses NOT_FOUND and 404 with a default message", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Resource not found");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
  });

  it("ConflictError uses CONFLICT and 409 with a default message", () => {
    const err = new ConflictError();
    expect(err.message).toBe("Resource conflict");
    expect(err.code).toBe("CONFLICT");
    expect(err.statusCode).toBe(409);
  });

  it("ForbiddenError uses FORBIDDEN and 403 with a default message", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Access forbidden");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.statusCode).toBe(403);
  });
});

describe("type guards", () => {
  it("isAppError narrows only AppError instances", () => {
    expect(isAppError(new DatabaseError("x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError({})).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  it("isValidationError narrows ValidationError instances", () => {
    expect(isValidationError(new ValidationError("x"))).toBe(true);
    expect(isValidationError(new DatabaseError("x"))).toBe(false);
  });

  it("isAuthError narrows AuthError instances", () => {
    expect(isAuthError(new AuthError())).toBe(true);
    expect(isAuthError(new DatabaseError("x"))).toBe(false);
  });

  it("isNotFoundError narrows NotFoundError instances", () => {
    expect(isNotFoundError(new NotFoundError())).toBe(true);
    expect(isNotFoundError(new DatabaseError("x"))).toBe(false);
  });
});
