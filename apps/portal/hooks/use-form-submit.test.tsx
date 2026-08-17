import { renderHook, act } from "@testing-library/react";
import { useFormSubmit } from "./use-form-submit";

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

describe("useFormSubmit", () => {
  beforeEach(() => {
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
  });

  it("shows success toast and calls onSuccess for a successful result", async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useFormSubmit(async () => ({ success: true, message: "Saved" }), {
        onSuccess,
        successMessage: "All good",
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("All good");
    expect(onSuccess).toHaveBeenCalledWith({ success: true, message: "Saved" });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("falls back to the result message for the success toast", async () => {
    const { result } = renderHook(() => useFormSubmit(async () => ({ message: "Done" })));

    await act(async () => {
      await result.current.submit();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Done");
  });

  it("shows an error toast and calls onError for a result with an error", async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useFormSubmit(async () => ({ error: "boom" }), { onError }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mockToastError).toHaveBeenCalledWith("boom");
    expect(onError).toHaveBeenCalledWith({ error: "boom" });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("does not toast a generic error when fieldErrors are present", async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useFormSubmit(async () => ({ fieldErrors: { email: "invalid" } }), { onError }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it("re-throws and calls onError when the action throws", async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useFormSubmit(
        async () => {
          throw new Error("network failed");
        },
        { onError },
      ),
    );

    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow("network failed");
    });

    expect(mockToastError).toHaveBeenCalledWith("network failed");
    expect(onError).toHaveBeenCalledWith("network failed");
    expect(result.current.isSubmitting).toBe(false);
  });
});
