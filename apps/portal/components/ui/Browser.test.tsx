import { Browser } from "@repo/ui/components/ui/browser";
import { render, screen } from "@testing-library/react";
import React from "react";

describe("Geist Browser Primitive", () => {
  it("renders with address bar and middle truncation for long urls", () => {
    render(
      <Browser address="https://www.vercel.com/docs/guides/deployments">
        <div data-testid="browser-content">Screenshot Content</div>
      </Browser>
    );

    expect(screen.getByTestId("browser-content")).toBeInTheDocument();
    // Address bar contains the host and truncated path
    const addressBar = screen.getByText(/vercel\.com/);
    expect(addressBar).toBeInTheDocument();
  });

  it("renders decorative window controls with aria-hidden", () => {
    const { container } = render(
      <Browser address="https://arch.coal">
        <div>Content</div>
      </Browser>
    );

    const chromeBar = container.querySelector("[aria-hidden='true']");
    expect(chromeBar).toBeInTheDocument();
    // 3 dots present inside decorative chrome bar
    const dots = chromeBar?.querySelectorAll(".rounded-full");
    expect(dots?.length).toBe(3);
  });

  it("supports custom className and locked aspect ratio", () => {
    const { container } = render(
      <Browser address="https://example.com" aspectRatio="16/9" className="custom-browser">
        <div>Locked</div>
      </Browser>
    );

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("custom-browser");
    expect(root).toHaveStyle({ aspectRatio: "16/9" });
  });
});
