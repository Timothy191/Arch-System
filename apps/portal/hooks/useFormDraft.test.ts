import { renderHook, act } from "@testing-library/react";
import { useFormDraft } from "./useFormDraft";

describe("useFormDraft", () => {
  const TEST_KEY = "test_draft_key";

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("should initialize with initial state when no draft exists", () => {
    const { result } = renderHook(() =>
      useFormDraft({
        key: TEST_KEY,
        initialState: { title: "Default" },
      }),
    );

    expect(result.current.draftState).toEqual({ title: "Default" });
    expect(result.current.hasRestoredDraft).toBe(false);
  });

  it("should restore saved draft from localStorage on mount", () => {
    const savedPayload = {
      data: { title: "Restored Title" },
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(TEST_KEY, JSON.stringify(savedPayload));

    const onRestoreMock = jest.fn();

    const { result } = renderHook(() =>
      useFormDraft({
        key: TEST_KEY,
        initialState: { title: "Default" },
        onRestore: onRestoreMock,
      }),
    );

    expect(result.current.draftState).toEqual({ title: "Restored Title" });
    expect(result.current.hasRestoredDraft).toBe(true);
    expect(onRestoreMock).toHaveBeenCalledWith({ title: "Restored Title" });
  });

  it("should save draft to localStorage when saveDraft is invoked", () => {
    const { result } = renderHook(() =>
      useFormDraft({
        key: TEST_KEY,
        initialState: { title: "Draft 1" },
      }),
    );

    act(() => {
      result.current.setDraftState({ title: "Draft 2" });
    });

    act(() => {
      result.current.saveDraft();
    });

    const stored = localStorage.getItem(TEST_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.data).toEqual({ title: "Draft 2" });
  });

  it("should clear draft from localStorage when clearDraft is invoked", () => {
    localStorage.setItem(TEST_KEY, JSON.stringify({ data: { title: "Saved" } }));

    const { result } = renderHook(() =>
      useFormDraft({
        key: TEST_KEY,
        initialState: { title: "Default" },
      }),
    );

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem(TEST_KEY)).toBeNull();
    expect(result.current.hasRestoredDraft).toBe(false);
  });
});
