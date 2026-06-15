import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BottomWidgetBar } from "./BottomWidgetBar";

jest.mock("next/navigation", () => ({
  usePathname: () => "/drilling",
}));

jest.mock("next/image", () => {
  const React = require("react");
  return function Image({ alt, ...props }: any) {
    return <img alt={alt} {...props} />;
  };
});

jest.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => {
    if (asChild) return children;
    return <button>{children}</button>;
  },
  DropdownMenuContent: ({ children, className }: any) => (
    <div className={className} data-testid="dropdown-content">
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, asChild }: any) => {
    if (asChild) return children;
    return <div>{children}</div>;
  },
  DropdownMenuSeparator: () => <hr />,
}));

describe("BottomWidgetBar", () => {
  it("renders trigger strip and bubble initially", () => {
    render(<BottomWidgetBar />);

    // Trigger strip visible when closed
    const triggerStrip = document.querySelector(".h-1.w-20");
    expect(triggerStrip).toBeInTheDocument();

    // Bubble button
    expect(screen.getByLabelText("Open dock")).toBeInTheDocument();
  });

  it("reveals radial wheel on bubble click and hides on second click", async () => {
    render(<BottomWidgetBar />);

    const bubble = screen.getByLabelText("Open dock");

    // Click to open
    fireEvent.click(bubble);

    await waitFor(() => {
      expect(screen.getByText("Ops")).toBeInTheDocument();
      expect(screen.getByText("Tools")).toBeInTheDocument();
      expect(screen.getByText("Hub")).toBeInTheDocument();
      expect(screen.getByText("Drilling")).toBeInTheDocument();
    });

    // Click again to close
    fireEvent.click(bubble);

    await waitFor(() => {
      expect(screen.queryByText("Ops")).not.toBeInTheDocument();
      expect(screen.queryByText("Hub")).not.toBeInTheDocument();
    });
  });

  it("closes wheel when clicking outside the dock", async () => {
    render(<BottomWidgetBar />);

    const bubble = screen.getByLabelText("Open dock");
    fireEvent.click(bubble);

    await waitFor(() => {
      expect(screen.getByText("Ops")).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Ops")).not.toBeInTheDocument();
    });
  });

  it("renders Operations items inside the dropdown content when wheel is open", async () => {
    render(<BottomWidgetBar />);

    const bubble = screen.getByLabelText("Open dock");
    fireEvent.click(bubble);

    await waitFor(() => {
      expect(screen.getByText("Ops")).toBeInTheDocument();
    });

    expect(screen.getByText("Drilling Operations")).toBeInTheDocument();
    expect(screen.getByText("Production Tracking")).toBeInTheDocument();
  });

  it("renders Tools and external items inside the dropdown content when wheel is open", async () => {
    render(<BottomWidgetBar />);

    const bubble = screen.getByLabelText("Open dock");
    fireEvent.click(bubble);

    await waitFor(() => {
      expect(screen.getByText("Tools")).toBeInTheDocument();
    });

    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("n8n Workflows")).toBeInTheDocument();
    expect(screen.getByText("Flowise AI")).toBeInTheDocument();
  });

  it("renders active indicator for active routes when wheel is open", async () => {
    render(<BottomWidgetBar />);

    const bubble = screen.getByLabelText("Open dock");
    fireEvent.click(bubble);

    await waitFor(() => {
      // "/drilling" is mock-active, so it should render the indicator dot
      const activeIndicator = document.querySelector(".absolute.bottom-1");
      expect(activeIndicator).toBeInTheDocument();
    });
  });

  it("toggles wheel visibility on Alt+D keyboard shortcut", async () => {
    render(<BottomWidgetBar />);

    // Initially not visible
    expect(screen.queryByText("Ops")).not.toBeInTheDocument();

    // Toggle on
    fireEvent.keyDown(window, { key: "d", altKey: true });
    await waitFor(() => {
      expect(screen.getByText("Ops")).toBeInTheDocument();
    });

    // Toggle off
    fireEvent.keyDown(window, { key: "d", altKey: true });
    await waitFor(() => {
      expect(screen.queryByText("Ops")).not.toBeInTheDocument();
    });
  });
});
