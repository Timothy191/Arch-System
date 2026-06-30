import React from "react";
import { render, screen } from "@testing-library/react";
import { ViewportBoundaries } from "./ViewportBoundaries";

describe("ViewportBoundaries component", () => {
  it("renders as a passive edge overlay without the legacy dock", () => {
    const { container } = render(<ViewportBoundaries />);
    expect(screen.queryByTestId("unified-dock")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("pointer-events-none");
  });
});
