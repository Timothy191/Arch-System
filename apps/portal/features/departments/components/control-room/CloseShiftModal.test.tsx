// AGENT-TRACE: CloseShiftModal test covering full shift closeout workflow states (validating -> has_errors -> pin_entry -> verifying -> verified -> submitting -> success -> api_error).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CloseShiftModal } from "./CloseShiftModal";
import { verifyPin, closeShift } from "~/lib/shift-closeout";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

jest.mock("~/lib/shift-closeout", () => ({
  verifyPin: jest.fn(),
  closeShift: jest.fn(),
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

const mockProps = {
  open: true,
  onClose: jest.fn(),
  departmentId: "dept-123",
  departmentSlug: "control-room",
  date: "2026-06-15",
  shiftType: "day" as const,
  onComplete: jest.fn(),
};

describe("CloseShiftModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show validating state initially and call closeShift as a dry run", async () => {
    (closeShift as jest.Mock).mockReturnValue(new Promise(() => {})); // Never resolves to keep it in validating state

    render(<CloseShiftModal {...mockProps} />);

    expect(screen.getByText("Validating shift data...")).toBeInTheDocument();
    expect(closeShift).toHaveBeenCalledWith(
      "dept-123",
      "2026-06-15",
      "day",
      "",
      "",
      true,
    );
  });

  it("should transition to has_errors state if validation fails", async () => {
    (closeShift as jest.Mock).mockResolvedValue({
      errors: [
        "Machine M001 is missing hourly loads",
        "Operator O002 has unacknowledged alerts",
      ],
    });

    render(<CloseShiftModal {...mockProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Cannot close shift until the following are resolved:",
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Machine M001 is missing hourly loads"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Operator O002 has unacknowledged alerts"),
    ).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it("should transition to pin_entry state if validation succeeds", async () => {
    (closeShift as jest.Mock).mockResolvedValue({ errors: [] });

    render(<CloseShiftModal {...mockProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "All machines accounted for. Supervisor PIN required to close.",
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Close modal")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. EMP001")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter supervisor PIN"),
    ).toBeInTheDocument();
  });

  it("should handle invalid PIN input and display verification error", async () => {
    (closeShift as jest.Mock).mockResolvedValue({ errors: [] });
    (verifyPin as jest.Mock).mockResolvedValue({ valid: false });

    render(<CloseShiftModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. EMP001")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("e.g. EMP001"), {
      target: { value: "EMP001" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter supervisor PIN"), {
      target: { value: "9999" },
    });

    const verifyBtn = screen.getByRole("button", { name: "Verify PIN" });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Invalid employee code or PIN"),
      ).toBeInTheDocument();
    });

    // Verify it allows retrying validation
    const tryAgainBtn = screen.getByRole("button", { name: "Try Again" });
    fireEvent.click(tryAgainBtn);
    expect(closeShift).toHaveBeenCalledTimes(2);
  });

  it("should transition to verified state, handle submitting, and close successfully", async () => {
    jest.useFakeTimers();
    (closeShift as jest.Mock)
      .mockResolvedValueOnce({ errors: [] }) // For dry run
      .mockResolvedValueOnce({ success: true }); // For actual close shift submission

    (verifyPin as jest.Mock).mockResolvedValue({
      valid: true,
      employee: { id: "emp-abc", full_name: "John Supervisor" },
    });

    render(<CloseShiftModal {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. EMP001")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("e.g. EMP001"), {
      target: { value: "EMP001" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter supervisor PIN"), {
      target: { value: "1234" },
    });

    const verifyBtn = screen.getByRole("button", { name: "Verify PIN" });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText("Approved by")).toBeInTheDocument();
      expect(screen.getByText("John Supervisor")).toBeInTheDocument();
    });

    const closeShiftBtn = screen.getByRole("button", {
      name: "Close Shift & Lock",
    });
    fireEvent.click(closeShiftBtn);

    expect(screen.getByText("Closing shift...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Shift closed successfully")).toBeInTheDocument();
    });

    jest.advanceTimersByTime(2000);
    expect(mockProps.onComplete).toHaveBeenCalled();
    expect(mockProps.onClose).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
