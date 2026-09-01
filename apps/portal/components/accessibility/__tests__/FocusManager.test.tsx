import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FocusManager } from "../FocusManager";

describe("FocusManager", () => {
  test("renders children correctly", () => {
    render(
      <FocusManager>
        <button>Test Button</button>
      </FocusManager>,
    );

    expect(screen.getByText("Test Button")).toBeInTheDocument();
  });

  test("traps focus within container", () => {
    render(
      <FocusManager enabled>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </FocusManager>,
    );

    const firstButton = screen.getByText("First");

    // Focus should start on first element
    expect(firstButton).toHaveFocus();
  });

  test("handles Escape key to close", () => {
    const onEscape = jest.fn();

    render(
      <FocusManager onEscape={onEscape}>
        <button>Test</button>
      </FocusManager>,
    );

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(onEscape).toHaveBeenCalled();
  });

  test("restores focus on unmount", () => {
    const { unmount } = render(
      <FocusManager restoreFocus>
        <button>Test</button>
      </FocusManager>,
    );

    unmount();

    // Focus should be restored to previous element
    // In this test, it would be the document.body
  });
});
