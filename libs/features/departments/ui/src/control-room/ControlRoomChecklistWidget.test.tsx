import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ControlRoomChecklistWidget } from "./ControlRoomChecklistWidget";

jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

describe("ControlRoomChecklistWidget", () => {
  const defaultProps = {
    departmentId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    departmentSlug: "control-room",
    date: "2026-08-18",
    shift: "day" as const,
    initialOperatorName: "Alice Operator",
  };

  it("renders header, KPI metrics, and category tabs", () => {
    render(<ControlRoomChecklistWidget {...defaultProps} />);

    expect(screen.getByText("Control Room Operations & Shift Checklist")).toBeInTheDocument();
    expect(screen.getByText("Alarm Response")).toBeInTheDocument();
    expect(screen.getByText("Incident Ack")).toBeInTheDocument();
    expect(screen.getByText("System Uptime")).toBeInTheDocument();
    expect(screen.getByText("Missed Incidents")).toBeInTheDocument();
    expect(screen.getByText("Daily Shift")).toBeInTheDocument();
    expect(screen.getByText("Weekly Tasks")).toBeInTheDocument();
  });

  it("toggles checklist item completion and updates progress", () => {
    render(<ControlRoomChecklistWidget {...defaultProps} />);

    const firstItem = screen.getByText(
      /Verify all monitoring systems \(CCTV, alarms, SCADA\) are online/,
    );
    expect(firstItem).toBeInTheDocument();

    // Toggle complete
    fireEvent.click(firstItem);
    expect(screen.getByText(/Verified at/)).toBeInTheDocument();
    expect(screen.getByText(/Signed: Alice Operator/)).toBeInTheDocument();

    // Toggle incomplete
    fireEvent.click(firstItem);
    expect(screen.queryByText(/Verified at/)).not.toBeInTheDocument();
  });

  it("switches category tabs and displays corresponding checklist items", () => {
    render(<ControlRoomChecklistWidget {...defaultProps} />);

    const weeklyTab = screen.getByText("Weekly Tasks");
    fireEvent.click(weeklyTab);

    expect(
      screen.getByText(/Perform end-to-end failover test of backup radio and satellite channels/),
    ).toBeInTheDocument();
  });

  it("submits operator shift report when form is submitted", async () => {
    const onSubmitReport = jest.fn().mockResolvedValue(undefined);
    render(<ControlRoomChecklistWidget {...defaultProps} onSubmitReport={onSubmitReport} />);

    const submitBtn = screen.getByRole("button", { name: /Submit Shift Verification/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitReport).toHaveBeenCalledTimes(1);
      expect(onSubmitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: defaultProps.departmentId,
          date: defaultProps.date,
          shift: "day",
          operatorName: "Alice Operator",
          missedIncidentsCount: 0,
        }),
      );
      expect(screen.getByText(/Log Submitted Successfully/)).toBeInTheDocument();
    });
  });
});
