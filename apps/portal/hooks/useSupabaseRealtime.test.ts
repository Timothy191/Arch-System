import { renderHook, act } from "@testing-library/react";
import { useSupabaseRealtime } from "@repo/shared/hooks";

describe("useSupabaseRealtime hook", () => {
  let mockRemoveChannel: jest.Mock;
  let mockSubscribe: jest.Mock;
  let mockOn: jest.Mock;
  let mockChannel: jest.Mock;
  let mockSupabaseClient: any;
  let capturedCallback: (_payload: any) => void;
  let capturedStatusCallback: (_status: string, _err?: Error) => void;

  beforeEach(() => {
    mockRemoveChannel = jest.fn().mockResolvedValue("ok");
    mockSubscribe = jest.fn().mockImplementation((cb) => {
      capturedStatusCallback = cb;
      cb("SUBSCRIBED");
      return { unsubscribe: jest.fn() };
    });
    mockOn = jest.fn().mockImplementation((_event, _config, cb) => {
      capturedCallback = cb;
      return { subscribe: mockSubscribe };
    });
    mockChannel = jest.fn().mockReturnValue({
      on: mockOn,
    });
    mockSupabaseClient = {
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    };
  });

  it("should initialize and subscribe to channel", () => {
    const { result } = renderHook(() =>
      useSupabaseRealtime({
        supabaseClient: mockSupabaseClient,
        table: "drill_operations",
      }),
    );

    expect(mockChannel).toHaveBeenCalled();
    expect(result.current.status).toBe("SUBSCRIBED");
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should dispatch INSERT, UPDATE, and DELETE events to respective callbacks", () => {
    const onInsert = jest.fn();
    const onUpdate = jest.fn();
    const onDelete = jest.fn();
    const onChange = jest.fn();

    renderHook(() =>
      useSupabaseRealtime({
        supabaseClient: mockSupabaseClient,
        table: "hourly_loads",
        onInsert,
        onUpdate,
        onDelete,
        onChange,
      }),
    );

    // Simulate INSERT
    act(() => {
      capturedCallback({
        eventType: "INSERT",
        new: { id: "1", tons: 50 },
        old: {},
        table: "hourly_loads",
        schema: "public",
      });
    });
    expect(onInsert).toHaveBeenCalledWith({ id: "1", tons: 50 });
    expect(onChange).toHaveBeenCalledTimes(1);

    // Simulate UPDATE
    act(() => {
      capturedCallback({
        eventType: "UPDATE",
        new: { id: "1", tons: 60 },
        old: { id: "1", tons: 50 },
        table: "hourly_loads",
        schema: "public",
      });
    });
    expect(onUpdate).toHaveBeenCalledWith({ id: "1", tons: 60 }, { id: "1", tons: 50 });
    expect(onChange).toHaveBeenCalledTimes(2);

    // Simulate DELETE
    act(() => {
      capturedCallback({
        eventType: "DELETE",
        new: {},
        old: { id: "1" },
        table: "hourly_loads",
        schema: "public",
      });
    });
    expect(onDelete).toHaveBeenCalledWith({ id: "1" });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("should handle TIMED_OUT subscription status", () => {
    const { result } = renderHook(() =>
      useSupabaseRealtime({
        supabaseClient: mockSupabaseClient,
        table: "breakdowns",
      }),
    );

    act(() => {
      capturedStatusCallback("TIMED_OUT", new Error("Connection timed out"));
    });

    expect(result.current.status).toBe("TIMED_OUT");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error?.message).toBe("Connection timed out");
  });

  it("should handle unmount and cleanup channel", () => {
    const { unmount } = renderHook(() =>
      useSupabaseRealtime({
        supabaseClient: mockSupabaseClient,
        table: "breakdowns",
      }),
    );

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
