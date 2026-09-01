import React from "react";
import { render, screen, act } from "@testing-library/react";
import { LiveRegion, Announcer } from "../LiveRegion";

describe("LiveRegion", () => {
  test("renders children with correct ARIA attributes", () => {
    render(
      <LiveRegion live="polite" atomic>
        <span>Test content</span>
      </LiveRegion>,
    );

    const region = screen.getByText("Test content").parentElement;

    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });

  test("renders with assertive live region", () => {
    render(
      <LiveRegion live="assertive">
        <span>Important message</span>
      </LiveRegion>,
    );

    const region = screen.getByText("Important message").parentElement;

    expect(region).toHaveAttribute("aria-live", "assertive");
  });
});

describe("Announcer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("announces message to screen readers", () => {
    render(<Announcer message="Test announcement" />);

    // Wait for the message to appear
    act(() => {
      jest.advanceTimersByTime(200);
    });

    const announcer = screen.getByText("Test announcement");
    // The LiveRegion wraps the content, so check the LiveRegion's div
    const liveRegion = announcer.closest("[aria-live]");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });

  test("uses assertive live region when specified", () => {
    render(<Announcer message="Urgent message" live="assertive" />);

    act(() => {
      jest.advanceTimersByTime(200);
    });

    const announcer = screen.getByText("Urgent message");
    const liveRegion = announcer.closest("[aria-live]");
    expect(liveRegion).toHaveAttribute("aria-live", "assertive");
  });
});
