// AGENT-TRACE: MachineControl test verifying initial defaults, input updates, parameter configuration application, and default resets.
import { render, screen, fireEvent } from "@testing-library/react";
import { MachineControl } from "./MachineControl";

// Mock Lucide icons
jest.mock("lucide-react", () => ({
  Activity: () => <div data-testid="activity-icon" />,
  RotateCcw: () => <div data-testid="reset-icon" />,
  ChevronUp: () => <div data-testid="chevron-up" />,
  ChevronDown: () => <div data-testid="chevron-down" />,
}));

jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

jest.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children, onClick, className, variant }: any) => (
    <button onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

describe("MachineControl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render default values for RPM, Power, and Pressure", () => {
    render(<MachineControl />);

    expect(screen.getByText("Operational Parameters")).toBeInTheDocument();

    const rpmInput = screen.getByLabelText(
      "Target Rotation Speed",
    ) as HTMLInputElement;
    const powerInput = screen.getByLabelText(
      "Power Allocation",
    ) as HTMLInputElement;
    const pressureInput = screen.getByLabelText(
      "Hydraulic Pressure",
    ) as HTMLInputElement;

    expect(rpmInput.value).toBe("1250");
    expect(powerInput.value).toBe("85");
    expect(pressureInput.value).toBe("420");
  });

  it("should allow editing parameter values", () => {
    render(<MachineControl />);

    const rpmInput = screen.getByLabelText(
      "Target Rotation Speed",
    ) as HTMLInputElement;
    const powerInput = screen.getByLabelText(
      "Power Allocation",
    ) as HTMLInputElement;
    const pressureInput = screen.getByLabelText(
      "Hydraulic Pressure",
    ) as HTMLInputElement;

    fireEvent.change(rpmInput, { target: { value: "1500" } });
    fireEvent.change(powerInput, { target: { value: "90" } });
    fireEvent.change(pressureInput, { target: { value: "450" } });

    expect(rpmInput.value).toBe("1500");
    expect(powerInput.value).toBe("90");
    expect(pressureInput.value).toBe("450");
  });

  it("should display last applied timestamp when Apply Configuration is clicked", () => {
    render(<MachineControl />);

    expect(screen.queryByText(/Applied at/)).not.toBeInTheDocument();

    const applyBtn = screen.getByRole("button", {
      name: "Apply Configuration",
    });
    fireEvent.click(applyBtn);

    expect(
      screen.getByText(/Applied at \d{1,2}:\d{2}:\d{2}/),
    ).toBeInTheDocument();
  });

  it("should reset inputs to defaults and clear applied timestamp when Reset Defaults is clicked", () => {
    render(<MachineControl />);

    const rpmInput = screen.getByLabelText(
      "Target Rotation Speed",
    ) as HTMLInputElement;
    fireEvent.change(rpmInput, { target: { value: "2000" } });

    const applyBtn = screen.getByRole("button", {
      name: "Apply Configuration",
    });
    fireEvent.click(applyBtn);
    expect(screen.getByText(/Applied at/)).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: "Reset Defaults" });
    fireEvent.click(resetBtn);

    expect(rpmInput.value).toBe("1250");
    expect(screen.queryByText(/Applied at/)).not.toBeInTheDocument();
  });
});
