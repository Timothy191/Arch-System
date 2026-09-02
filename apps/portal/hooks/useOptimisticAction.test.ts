import { renderHook, act } from "@testing-library/react";
import { useOptimisticAction } from "@repo/shared/hooks";

interface BreakdownState {
  id: string;
  status: "active" | "completed";
}

describe("useOptimisticAction hook", () => {
  it("should apply optimistic update and resolve on successful action", async () => {
    const initialState: BreakdownState = { id: "101", status: "active" };
    const mockAction = jest.fn().mockResolvedValue({
      success: true,
      data: { id: "101", status: "completed" },
    });
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useOptimisticAction({
        currentState: initialState,
        updateFn: (state, input: { status: "active" | "completed" }) => ({
          ...state,
          status: input.status,
        }),
        action: mockAction,
        onSuccess,
      }),
    );

    expect(result.current.state.status).toBe("active");

    await act(async () => {
      result.current.execute({ status: "completed" });
    });

    expect(mockAction).toHaveBeenCalledWith({ status: "completed" });
    expect(onSuccess).toHaveBeenCalledWith({ id: "101", status: "completed" });
    expect(result.current.error).toBeNull();
  });

  it("should call onError when server action returns failure", async () => {
    const initialState: BreakdownState = { id: "102", status: "active" };
    const mockAction = jest.fn().mockResolvedValue({
      success: false,
      error: "Unauthorized modification",
    });
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useOptimisticAction({
        currentState: initialState,
        updateFn: (state, input: { status: "active" | "completed" }) => ({
          ...state,
          status: input.status,
        }),
        action: mockAction,
        onError,
      }),
    );

    await act(async () => {
      result.current.execute({ status: "completed" });
    });

    expect(onError).toHaveBeenCalledWith("Unauthorized modification");
    expect(result.current.error).toBe("Unauthorized modification");
  });
});
