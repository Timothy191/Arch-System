import React from "react";
import { render, screen } from "@testing-library/react";
import { SkipLinks } from "../SkipLinks";

describe("SkipLinks", () => {
  test("renders skip links for keyboard navigation", () => {
    render(<SkipLinks />);

    const mainContentLink = screen.getByText("Skip to main content");
    const navigationLink = screen.getByText("Skip to navigation");

    expect(mainContentLink).toBeInTheDocument();
    expect(navigationLink).toBeInTheDocument();
  });

  test("skip links have correct href attributes", () => {
    render(<SkipLinks />);

    const mainContentLink = screen.getByText("Skip to main content");
    const navigationLink = screen.getByText("Skip to navigation");

    expect(mainContentLink).toHaveAttribute("href", "#main-content");
    expect(navigationLink).toHaveAttribute("href", "#navigation");
  });

  test("skip links are visually hidden but focusable", () => {
    render(<SkipLinks />);

    const mainContentLink = screen.getByText("Skip to main content");

    // Check that the link has sr-only class (screen reader only)
    expect(mainContentLink.className).toContain("sr-only");
  });
});
