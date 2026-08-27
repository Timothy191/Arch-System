import { render, screen, fireEvent } from "@testing-library/react";
import { ThreeHeroRotator } from "@repo/ui/ThreeHeroRotator";
import { ThreeHeroRotatorDynamic } from "@repo/ui/ThreeHeroRotatorDynamic";
import { Panel } from "@repo/ui/HeroRotator";

jest.mock("@react-three/fiber", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    Canvas: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "r3f-canvas" }, children),
    useFrame: jest.fn(),
  };
});

jest.mock("@react-three/drei", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    Html: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "r3f-html" }, children),
  };
});

jest.mock("next/dynamic", () => () => {
  const { ThreeHeroRotator: ActualThreeHeroRotator } = jest.requireActual(
    "@repo/ui/ThreeHeroRotator",
  );
  return ActualThreeHeroRotator;
});

const mockPanels: Panel[] = [
  {
    id: "overview",
    name: "overview",
    title: "System Overview",
    description: "Central operations",
    category: "Central Command",
    image: "/images/departments/overview.jpg",
    stats: { label: "System Health", value: "100%" },
    status: "active",
    icon: <span data-testid="icon-overview" />,
    iconBgColor: "bg-blue-500/10",
    primary: { href: "/overview", label: "Overview", icon: <span /> },
    secondary: { href: "/overview?tab=audit", label: "Audit Reports", icon: <span /> },
  },
  {
    id: "drilling",
    name: "drilling",
    title: "Drilling Operations",
    description: "Drill rig telemetry",
    category: "Field Operations",
    image: "/images/departments/drilling.jpg",
    stats: { label: "Depth", value: "1,240m" },
    status: "active",
    icon: <span data-testid="icon-drilling" />,
    iconBgColor: "bg-blue-500/10",
    primary: { href: "/drilling", label: "Launch Drilling", icon: <span /> },
  },
  {
    id: "production",
    name: "production",
    title: "Production",
    description: "Extraction tracking",
    category: "Field Operations",
    image: "/images/departments/production.jpg",
    stats: { label: "Yield", value: "85%" },
    status: "active",
    icon: <span data-testid="icon-production" />,
    iconBgColor: "bg-emerald-500/10",
    primary: { href: "/production", label: "Launch Production", icon: <span /> },
  },
];

describe("ThreeHeroRotator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all panels in the 3D projection tree", () => {
    render(<ThreeHeroRotator panels={mockPanels} />);

    expect(screen.getByText("System Overview")).toBeInTheDocument();
    expect(screen.getByText("Drilling Operations")).toBeInTheDocument();
    expect(screen.getByText("Production")).toBeInTheDocument();
  });

  it("sets aria-hidden=false on active card and true on inactive cards", () => {
    const { container } = render(<ThreeHeroRotator panels={mockPanels} />);
    const slides = container.querySelectorAll('[role="group"]');
    expect(slides).toHaveLength(3);

    expect(slides[0].getAttribute("aria-hidden")).toBe("false");
    expect(slides[1].getAttribute("aria-hidden")).toBe("true");
    expect(slides[2].getAttribute("aria-hidden")).toBe("true");
  });

  it("removes inactive CTA links from the tab order", () => {
    const { container } = render(<ThreeHeroRotator panels={mockPanels} />);
    const primaryCtas = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-cta="primary-hero"]'),
    );
    expect(primaryCtas).toHaveLength(3);
    expect(primaryCtas[0]).toHaveAttribute("tabindex", "0");
    expect(primaryCtas[1]).toHaveAttribute("tabindex", "-1");
    expect(primaryCtas[2]).toHaveAttribute("tabindex", "-1");
  });

  it("advances and retreats active index when Next and Prev buttons are clicked", () => {
    render(<ThreeHeroRotator panels={mockPanels} />);
    const nextBtn = screen.getByLabelText("Next highlight");
    const prevBtn = screen.getByLabelText("Previous highlight");

    fireEvent.click(nextBtn);
    expect(screen.getByLabelText("2 of 3: Drilling Operations")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    fireEvent.click(prevBtn);
    expect(screen.getByLabelText("1 of 3: System Overview")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });

  it("jumps to specific slide when dot indicator is clicked", () => {
    render(<ThreeHeroRotator panels={mockPanels} />);
    const jumpToProduction = screen.getByLabelText("Jump to Production");

    fireEvent.click(jumpToProduction);
    expect(screen.getByLabelText("3 of 3: Production")).toHaveAttribute("aria-hidden", "false");
  });

  it("handles keyboard navigation (ArrowLeft / ArrowRight / Space)", () => {
    const { container } = render(<ThreeHeroRotator panels={mockPanels} />);
    const carousel = container.querySelector('[role="region"]')!;

    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(screen.getByLabelText("2 of 3: Drilling Operations")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(screen.getByLabelText("1 of 3: System Overview")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    // Pause toggle with Space
    const pauseBtn = screen.getByLabelText("Pause auto rotation");
    fireEvent.keyDown(carousel, { key: " " });
    expect(screen.getByLabelText("Resume auto rotation")).toBeInTheDocument();
  });

  it("handles touch swipe gestures", () => {
    const { container } = render(<ThreeHeroRotator panels={mockPanels} />);
    const swipeContainer = container.querySelector(".touch-pan-y")!;

    // Swipe left to advance
    fireEvent.touchStart(swipeContainer, {
      touches: [{ clientX: 300, clientY: 100 }],
    });
    fireEvent.touchEnd(swipeContainer, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(screen.getByLabelText("2 of 3: Drilling Operations")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    // Swipe right to retreat
    fireEvent.touchStart(swipeContainer, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(swipeContainer, {
      changedTouches: [{ clientX: 300, clientY: 100 }],
    });
    expect(screen.getByLabelText("1 of 3: System Overview")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });

  it("renders urgency badges and nominal badge correctly", () => {
    const { rerender } = render(
      <ThreeHeroRotator
        panels={mockPanels}
        incidentCount={2}
        breakdownCount={1}
        offlineMachineCount={3}
      />,
    );

    expect(screen.getAllByText("2 Open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 Breakdown").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 Offline").length).toBeGreaterThan(0);

    rerender(<ThreeHeroRotator panels={mockPanels} />);
    expect(screen.getAllByText("Nominal").length).toBeGreaterThan(0);
  });

  it("renders via ThreeHeroRotatorDynamic wrapper", () => {
    render(<ThreeHeroRotatorDynamic panels={mockPanels} />);
    expect(screen.getByText("System Overview")).toBeInTheDocument();
  });
});
