import { render, screen } from "@testing-library/react";
import { EveLogo } from "@repo/ui/EveLogo";
import { EveStatusBar } from "@repo/ui/EveStatusBar";

describe("EveLogo", () => {
  it("renders the official eve wordmark with a lowercase aria-label", () => {
    render(<EveLogo />);

    const svg = screen.getByRole("img", { name: "eve" });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 169 53");
    // Brand rule: the mark is always lowercase "eve" — never "Eve" or "EVE".
    expect(svg.getAttribute("aria-label")).toBe("eve");
  });

  it("forwards className to the svg", () => {
    render(<EveLogo className="h-3 w-auto text-sky-800" />);

    const svg = screen.getByRole("img", { name: "eve" });
    const classAttr = svg.getAttribute("class") ?? "";
    expect(classAttr).toContain("h-3");
    expect(classAttr).toContain("text-sky-800");
  });
});

describe("EveStatusBar", () => {
  it("renders the lowercase eve agentic system label and ONLINE badge", () => {
    render(<EveStatusBar />);

    expect(screen.getByText("eve agentic system")).toBeInTheDocument();
    expect(screen.getByText("ONLINE")).toBeInTheDocument();
  });

  it("renders the three status chips", () => {
    render(<EveStatusBar />);

    expect(screen.getByText("Portal Watch")).toBeInTheDocument();
    expect(screen.getByText("Backend Ops")).toBeInTheDocument();
    expect(screen.getByText("RFID Ingest")).toBeInTheDocument();
  });
});
