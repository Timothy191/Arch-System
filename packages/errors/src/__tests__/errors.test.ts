import {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  APIError,
  DatabaseError,
  RateLimitError,
  FetchTimeoutError,
  NetworkError,
  isAppError,
  isValidationError,
  isAuthError,
  isNotFoundError,
  isFetchTimeoutError,
  isNetworkError,
} from "../index";

describe("AppError (base class)", () => {
  describe("constructor overloads", () => {
    test("creates with message only", () => {
      const err = new AppError("test error");
      expect(err.message).toBe("test error");
      expect(err.name).toBe("AppError");
      expect(err.code).toBeUndefined();
      expect(err.statusCode).toBeUndefined();
      expect(err.context).toBeUndefined();
      expect(err.cause).toBeUndefined();
    });

    test("creates with message and code string", () => {
      const err = new AppError("test error", "TEST_CODE");
      expect(err.message).toBe("test error");
      expect(err.code).toBe("TEST_CODE");
      expect(err.statusCode).toBeUndefined();
    });

    test("creates with message, code, and statusCode", () => {
      const err = new AppError("test error", "TEST_CODE", 400);
      expect(err.message).toBe("test error");
      expect(err.code).toBe("TEST_CODE");
      expect(err.statusCode).toBe(400);
    });

    test("creates with options object", () => {
      const cause = new Error("root cause");
      const err = new AppError("test error", {
        code: "CUSTOM_CODE",
        statusCode: 500,
        context: { requestId: "123" },
        cause,
      });
      expect(err.message).toBe("test error");
      expect(err.code).toBe("CUSTOM_CODE");
      expect(err.statusCode).toBe(500);
      expect(err.context).toEqual({ requestId: "123" });
      expect(err.cause).toBe(cause);
    });

    test("merges extra options into context", () => {
      const err = new AppError("test error", {
        code: "CUSTOM_CODE",
        context: { existing: "value" },
        extraField: "extra",
        anotherField: 42,
      });
      expect(err.context).toEqual({
        existing: "value",
        extraField: "extra",
        anotherField: 42,
      });
    });
  });

  describe("error inheritance", () => {
    test("is instance of Error", () => {
      const err = new AppError("test");
      expect(err).toBeInstanceOf(Error);
    });

    test("is instance of AppError", () => {
      const err = new AppError("test");
      expect(err).toBeInstanceOf(AppError);
    });

    test("has correct stack trace", () => {
      const err = new AppError("test");
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain("AppError");
    });
  });
});

describe("ValidationError", () => {
  test("uses VALIDATION_ERROR code and 400 status", () => {
    const err = new ValidationError("invalid input");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("ValidationError");
  });

  test("places field and value into context", () => {
    const err = new ValidationError("invalid email", {
      field: "email",
      value: "not-an-email",
    });
    expect(err.context).toMatchObject({
      field: "email",
      value: "not-an-email",
    });
  });

  test("merges extra options into context", () => {
    const err = new ValidationError("invalid input", {
      field: "password",
      constraint: "min-length-8",
      regex: "^.{8,}$",
    });
    expect(err.context).toMatchObject({
      field: "password",
      constraint: "min-length-8",
      regex: "^.{8,}$",
    });
  });

  test("preserves cause chain", () => {
    const cause = new Error("zod validation failed");
    const err = new ValidationError("invalid input", { cause });
    expect(err.cause).toBe(cause);
  });

  test("handles undefined value correctly", () => {
    const err = new ValidationError("required field", {
      field: "username",
      value: undefined,
    });
    expect(err.context).toMatchObject({ field: "username" });
    expect(err.context).not.toHaveProperty("value");
  });

  test("is instance of AppError", () => {
    const err = new ValidationError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ValidationError);
  });
});

describe("AuthError", () => {
  test("uses AUTH_ERROR code and 401 status", () => {
    const err = new AuthError("unauthorized");
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("AuthError");
  });

  test("merges extra options into context", () => {
    const err = new AuthError("invalid token", {
      tokenType: "Bearer",
      expiredAt: "2024-01-01",
    });
    expect(err.context).toMatchObject({
      tokenType: "Bearer",
      expiredAt: "2024-01-01",
    });
  });

  test("preserves cause chain", () => {
    const cause = new Error("jwt expired");
    const err = new AuthError("token expired", { cause });
    expect(err.cause).toBe(cause);
  });

  test("is instance of AppError", () => {
    const err = new AuthError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(AuthError);
  });
});

describe("ForbiddenError", () => {
  test("uses FORBIDDEN_ERROR code and 403 status", () => {
    const err = new ForbiddenError("access denied");
    expect(err.code).toBe("FORBIDDEN_ERROR");
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe("ForbiddenError");
  });

  test("merges extra options into context", () => {
    const err = new ForbiddenError("insufficient permissions", {
      requiredRole: "admin",
      currentRole: "operator",
    });
    expect(err.context).toMatchObject({
      requiredRole: "admin",
      currentRole: "operator",
    });
  });

  test("is instance of AppError", () => {
    const err = new ForbiddenError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ForbiddenError);
  });
});

describe("NotFoundError", () => {
  test("uses NOT_FOUND code and 404 status", () => {
    const err = new NotFoundError("resource not found");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("NotFoundError");
  });

  test("merges extra options into context", () => {
    const err = new NotFoundError("user not found", {
      userId: "123",
      resource: "user",
    });
    expect(err.context).toMatchObject({
      userId: "123",
      resource: "user",
    });
  });

  test("is instance of AppError", () => {
    const err = new NotFoundError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(NotFoundError);
  });
});

describe("ConflictError", () => {
  test("uses CONFLICT_ERROR code and 409 status", () => {
    const err = new ConflictError("resource conflict");
    expect(err.code).toBe("CONFLICT_ERROR");
    expect(err.statusCode).toBe(409);
    expect(err.name).toBe("ConflictError");
  });

  test("merges extra options into context", () => {
    const err = new ConflictError("duplicate entry", {
      existingId: "456",
      attemptedValue: "new-value",
    });
    expect(err.context).toMatchObject({
      existingId: "456",
      attemptedValue: "new-value",
    });
  });

  test("is instance of AppError", () => {
    const err = new ConflictError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ConflictError);
  });
});

describe("DatabaseError", () => {
  test("uses DATABASE_ERROR code and 500 status", () => {
    const err = new DatabaseError("query failed");
    expect(err.code).toBe("DATABASE_ERROR");
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe("DatabaseError");
  });

  test("merges extra options into context", () => {
    const err = new DatabaseError("connection timeout", {
      host: "localhost",
      port: 5432,
      query: "SELECT * FROM users",
    });
    expect(err.context).toMatchObject({
      host: "localhost",
      port: 5432,
      query: "SELECT * FROM users",
    });
  });

  test("preserves cause chain", () => {
    const cause = new Error("ECONNREFUSED");
    const err = new DatabaseError("connection failed", { cause });
    expect(err.cause).toBe(cause);
  });

  test("is instance of AppError", () => {
    const err = new DatabaseError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(DatabaseError);
  });
});

describe("RateLimitError", () => {
  test("uses RATE_LIMIT_ERROR code and 429 status", () => {
    const err = new RateLimitError("too many requests");
    expect(err.code).toBe("RATE_LIMIT_ERROR");
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe("RateLimitError");
  });

  test("merges extra options into context", () => {
    const err = new RateLimitError("rate limited", {
      limit: 100,
      windowMs: 60000,
      retryAfter: 30,
    });
    expect(err.context).toMatchObject({
      limit: 100,
      windowMs: 60000,
      retryAfter: 30,
    });
  });

  test("is instance of AppError", () => {
    const err = new RateLimitError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(RateLimitError);
  });
});

describe("APIError", () => {
  test("creates with Response object", () => {
    const response = new Response(null, { status: 503 });
    const err = new APIError("upstream failed", response);
    expect(err.code).toBe("API_ERROR");
    expect(err.statusCode).toBe(503);
    expect(err.response).toBe(response);
    expect(err.name).toBe("APIError");
  });

  test("creates with options object", () => {
    const err = new APIError("bad gateway", {
      statusCode: 502,
      context: { origin: "worker" },
    });
    expect(err.code).toBe("API_ERROR");
    expect(err.statusCode).toBe(502);
    expect(err.context).toEqual({ origin: "worker" });
  });

  test("merges extra options into context", () => {
    const err = new APIError("bad gateway", {
      statusCode: 502,
      context: { origin: "worker" },
      requestId: "req-123",
      timestamp: "2024-01-01",
    });
    expect(err.context).toEqual({
      origin: "worker",
      requestId: "req-123",
      timestamp: "2024-01-01",
    });
  });

  test("preserves cause chain", () => {
    const cause = new Error("network error");
    const err = new APIError("request failed", { cause });
    expect(err.cause).toBe(cause);
  });

  test("is instance of AppError", () => {
    const err = new APIError("test");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(APIError);
  });
});

describe("FetchTimeoutError", () => {
  test("uses FETCH_TIMEOUT code and 504 status", () => {
    const err = new FetchTimeoutError();
    expect(err.code).toBe("FETCH_TIMEOUT");
    expect(err.statusCode).toBe(504);
    expect(err.name).toBe("FetchTimeoutError");
    expect(err.message).toBe("Request timed out");
  });

  test("creates with custom message", () => {
    const err = new FetchTimeoutError("custom timeout message");
    expect(err.message).toBe("custom timeout message");
  });

  test("includes timeout details in context", () => {
    const err = new FetchTimeoutError("timeout", {
      timeoutMs: 5000,
      url: "https://api.example.com/data",
      method: "GET",
    });
    expect(err.context).toMatchObject({
      timeoutMs: 5000,
      url: "https://api.example.com/data",
      method: "GET",
    });
  });

  test("merges extra options into context", () => {
    const err = new FetchTimeoutError("timeout", {
      timeoutMs: 5000,
      requestId: "req-789",
    });
    expect(err.context).toMatchObject({
      timeoutMs: 5000,
      requestId: "req-789",
    });
  });

  test("preserves cause chain", () => {
    const cause = new Error("AbortError");
    const err = new FetchTimeoutError("timeout", { cause });
    expect(err.cause).toBe(cause);
  });

  test("is instance of APIError and AppError", () => {
    const err = new FetchTimeoutError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(APIError);
    expect(err).toBeInstanceOf(FetchTimeoutError);
  });
});

describe("NetworkError", () => {
  test("uses NETWORK_ERROR code and 503 status", () => {
    const err = new NetworkError();
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.statusCode).toBe(503);
    expect(err.name).toBe("NetworkError");
    expect(err.message).toBe("Network request failed");
  });

  test("creates with custom message", () => {
    const err = new NetworkError("connection refused");
    expect(err.message).toBe("connection refused");
  });

  test("includes network details in context", () => {
    const err = new NetworkError("network error", {
      url: "https://api.example.com/data",
      method: "POST",
    });
    expect(err.context).toMatchObject({
      url: "https://api.example.com/data",
      method: "POST",
    });
  });

  test("merges extra options into context", () => {
    const err = new NetworkError("network error", {
      url: "https://api.example.com",
      errorCode: "ECONNREFUSED",
    });
    expect(err.context).toMatchObject({
      url: "https://api.example.com",
      errorCode: "ECONNREFUSED",
    });
  });

  test("preserves cause chain", () => {
    const cause = new Error("fetch failed");
    const err = new NetworkError("network error", { cause });
    expect(err.cause).toBe(cause);
  });

  test("is instance of APIError and AppError", () => {
    const err = new NetworkError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(APIError);
    expect(err).toBeInstanceOf(NetworkError);
  });
});

describe("Type Guards", () => {
  describe("isAppError", () => {
    test("returns true for AppError instances", () => {
      expect(isAppError(new AppError("test"))).toBe(true);
      expect(isAppError(new ValidationError("test"))).toBe(true);
      expect(isAppError(new AuthError("test"))).toBe(true);
      expect(isAppError(new DatabaseError("test"))).toBe(true);
      expect(isAppError(new APIError("test"))).toBe(true);
      expect(isAppError(new FetchTimeoutError())).toBe(true);
      expect(isAppError(new NetworkError())).toBe(true);
    });

    test("returns false for non-AppError values", () => {
      expect(isAppError(new Error("test"))).toBe(false);
      expect(isAppError({})).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError("string")).toBe(false);
      expect(isAppError(42)).toBe(false);
    });
  });

  describe("isValidationError", () => {
    test("returns true for ValidationError instances", () => {
      expect(isValidationError(new ValidationError("test"))).toBe(true);
    });

    test("returns false for other error types", () => {
      expect(isValidationError(new AppError("test"))).toBe(false);
      expect(isValidationError(new AuthError("test"))).toBe(false);
      expect(isValidationError(new DatabaseError("test"))).toBe(false);
      expect(isValidationError(new Error("test"))).toBe(false);
      expect(isValidationError(null)).toBe(false);
    });
  });

  describe("isAuthError", () => {
    test("returns true for AuthError instances", () => {
      expect(isAuthError(new AuthError("test"))).toBe(true);
    });

    test("returns false for other error types", () => {
      expect(isAuthError(new AppError("test"))).toBe(false);
      expect(isAuthError(new ValidationError("test"))).toBe(false);
      expect(isAuthError(new DatabaseError("test"))).toBe(false);
      expect(isAuthError(new Error("test"))).toBe(false);
      expect(isAuthError(null)).toBe(false);
    });
  });

  describe("isNotFoundError", () => {
    test("returns true for NotFoundError instances", () => {
      expect(isNotFoundError(new NotFoundError("test"))).toBe(true);
    });

    test("returns false for other error types", () => {
      expect(isNotFoundError(new AppError("test"))).toBe(false);
      expect(isNotFoundError(new ValidationError("test"))).toBe(false);
      expect(isNotFoundError(new DatabaseError("test"))).toBe(false);
      expect(isNotFoundError(new Error("test"))).toBe(false);
      expect(isNotFoundError(null)).toBe(false);
    });
  });

  describe("isFetchTimeoutError", () => {
    test("returns true for FetchTimeoutError instances", () => {
      expect(isFetchTimeoutError(new FetchTimeoutError())).toBe(true);
    });

    test("returns false for other error types", () => {
      expect(isFetchTimeoutError(new APIError("test"))).toBe(false);
      expect(isFetchTimeoutError(new NetworkError())).toBe(false);
      expect(isFetchTimeoutError(new AppError("test"))).toBe(false);
      expect(isFetchTimeoutError(new Error("test"))).toBe(false);
      expect(isFetchTimeoutError(null)).toBe(false);
    });
  });

  describe("isNetworkError", () => {
    test("returns true for NetworkError instances", () => {
      expect(isNetworkError(new NetworkError())).toBe(true);
    });

    test("returns false for other error types", () => {
      expect(isNetworkError(new APIError("test"))).toBe(false);
      expect(isNetworkError(new FetchTimeoutError())).toBe(false);
      expect(isNetworkError(new AppError("test"))).toBe(false);
      expect(isNetworkError(new Error("test"))).toBe(false);
      expect(isNetworkError(null)).toBe(false);
    });
  });
});

describe("Error Chaining and Context", () => {
  test("supports deep error chaining", () => {
    const rootCause = new Error("database connection refused");
    const dbError = new DatabaseError("query failed", { cause: rootCause });
    const apiError = new APIError("upstream error", { cause: dbError });

    expect(apiError.cause).toBe(dbError);
    expect((apiError.cause as DatabaseError).cause).toBe(rootCause);
  });

  test("context can hold complex nested objects", () => {
    const err = new ValidationError("complex validation", {
      field: "config",
      value: { nested: { deep: true } },
      metadata: { timestamp: Date.now(), source: "schema" },
    });

    expect(err.context).toEqual({
      field: "config",
      value: { nested: { deep: true } },
      metadata: { timestamp: expect.any(Number), source: "schema" },
    });
  });

  test("multiple error instances are independent", () => {
    const err1 = new ValidationError("first", { field: "email" });
    const err2 = new ValidationError("second", { field: "password" });

    expect(err1.context).toEqual({ field: "email" });
    expect(err2.context).toEqual({ field: "password" });
  });
});
