import { render } from "@testing-library/react";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("returns null when there is fewer than 2 data points", () => {
    const { container } = render(<Sparkline data={[5]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders an SVG for a valid series", () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5]} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("width")).toBe("80");
    expect(svg!.getAttribute("height")).toBe("28");
  });

  it("uses cyan for an upward trend", () => {
    const { container } = render(<Sparkline data={[2, 4, 6]} />);
    expect(container.innerHTML).toContain("#00f0ff");
    expect(container.innerHTML).not.toContain("#ff4b5c");
  });

  it("uses coral for a downward trend", () => {
    const { container } = render(<Sparkline data={[6, 4, 2]} />);
    expect(container.innerHTML).toContain("#ff4b5c");
  });

  it("honors custom dimensions", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={120} height={40} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("120");
    expect(svg.getAttribute("height")).toBe("40");
  });
});
