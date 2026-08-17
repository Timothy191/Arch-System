import { extractErrorMessage, handleApiError } from "./utils";
import { DatabaseError, ValidationError, NotFoundError } from "./error-classes";

// Mock sonner toast so handleApiError does not touch the real UI stack
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

describe("extractErrorMessage", () => {
  const fallback = "An unexpected error occurred";

  it("returns the fallback for falsy errors", () => {
    expect(extractErrorMessage(null)).toBe(fallback);
    expect(extractErrorMessage(undefined)).toBe(fallback);
    expect(extractErrorMessage("")).toBe(fallback);
    expect(extractErrorMessage(0)).toBe(fallback);
  });

  it("returns the string itself for string errors", () => {
    expect(extractErrorMessage("boom")).toBe("boom");
  });

  it("returns the message of an AppError", () => {
    const err = new NotFoundError("missing resource");
    expect(extractErrorMessage(err)).toBe("missing resource");
  });

  it("returns the message of a generic Error", () => {
    expect(extractErrorMessage(new Error("generic failure"))).toBe("generic failure");
  });

  it("extracts a message from an object with a message property", () => {
    expect(extractErrorMessage({ message: "api said no" })).toBe("api said no");
  });

  it("extracts a message from an object with an error property", () => {
    expect(extractErrorMessage({ error: "invalid token" })).toBe("invalid token");
  });

  it("prefers the message property over the error property", () => {
    expect(extractErrorMessage({ message: "msg", error: "err" })).toBe("msg");
  });

  it("returns the fallback for unrecognized shapes", () => {
    expect(extractErrorMessage({ code: 500 })).toBe(fallback);
    expect(extractErrorMessage(42)).toBe(fallback);
    expect(extractErrorMessage(true)).toBe(fallback);
  });

  it("uses a custom fallback when provided", () => {
    expect(extractErrorMessage(null, "custom fallback")).toBe("custom fallback");
  });
});

describe("handleApiError", () => {
  beforeEach(() => mockToastError.mockClear());

  it("shows a toast with the extracted message and returns it", () => {
    const result = handleApiError(new Error("request failed"));
    expect(result).toBe("request failed");
    expect(mockToastError).toHaveBeenCalledWith("request failed");
  });

  it("uses the fallback message when the error carries no message", () => {
    const result = handleApiError({ status: 500 }, "Something went wrong");
    expect(result).toBe("Something went wrong");
    expect(mockToastError).toHaveBeenCalledWith("Something went wrong");
  });

  it("handles AppErrors and ValidationErrors", () => {
    const dbErr = new DatabaseError("db write failed");
    const validationErr = new ValidationError("invalid input", { field: "email" });
    expect(handleApiError(dbErr)).toBe("db write failed");
    expect(handleApiError(validationErr)).toBe("invalid input");
    expect(mockToastError).toHaveBeenCalledTimes(2);
  });
});
