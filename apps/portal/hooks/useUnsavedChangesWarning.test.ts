import { renderHook } from "@testing-library/react";
import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

describe("useUnsavedChangesWarning", () => {
  let confirmMock: jest.SpyInstance;

  beforeEach(() => {
    confirmMock = jest.spyOn(window, "confirm").mockImplementation(() => true);
    jest.spyOn(window, "addEventListener");
    jest.spyOn(window, "removeEventListener");
    jest.spyOn(document, "addEventListener");
    jest.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not add any listeners when isDirty is false", () => {
    renderHook(() => useUnsavedChangesWarning(false));

    expect(window.addEventListener).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(document.addEventListener).not.toHaveBeenCalledWith("click", expect.any(Function), true);
    expect(window.addEventListener).not.toHaveBeenCalledWith("popstate", expect.any(Function));
  });

  it("adds listeners when isDirty is true and removes them on unmount", () => {
    const { unmount } = renderHook(() => useUnsavedChangesWarning(true));

    expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(document.addEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
    expect(window.addEventListener).toHaveBeenCalledWith("popstate", expect.any(Function));

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(document.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
    expect(window.removeEventListener).toHaveBeenCalledWith("popstate", expect.any(Function));
  });

  it("triggers beforeunload confirmation when event is fired", () => {
    renderHook(() => useUnsavedChangesWarning(true));

    const beforeUnloadCall = (window.addEventListener as jest.Mock).mock.calls.find(
      (call) => call[0] === "beforeunload",
    );
    expect(beforeUnloadCall).toBeDefined();

    const handler = beforeUnloadCall[1];
    const event = { preventDefault: jest.fn(), returnValue: "" } as any;

    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toContain("unsaved changes");
  });

  it("intercepts same-origin link clicks", () => {
    renderHook(() => useUnsavedChangesWarning(true));

    const clickCall = (document.addEventListener as jest.Mock).mock.calls.find(
      (call) => call[0] === "click" && call[2] === true,
    );
    expect(clickCall).toBeDefined();

    const handler = clickCall[1];

    const mockAnchor = document.createElement("a");
    mockAnchor.setAttribute("href", "/drilling/machines");

    const event = {
      target: mockAnchor,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as any;

    confirmMock.mockReturnValue(false);

    handler(event);

    expect(window.confirm).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("does not prevent default on external or invalid links", () => {
    renderHook(() => useUnsavedChangesWarning(true));

    const clickCall = (document.addEventListener as jest.Mock).mock.calls.find(
      (call) => call[0] === "click" && call[2] === true,
    );
    const handler = clickCall[1];

    const mockAnchor = document.createElement("a");
    mockAnchor.setAttribute("href", "https://google.com");

    const event = {
      target: mockAnchor,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as any;

    handler(event);

    expect(window.confirm).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
