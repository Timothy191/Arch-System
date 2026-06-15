import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AlertPanel } from "./AlertPanel";

jest.mock("@repo/supabase/client", () => ({
  createBrowserSupabaseClient: jest.fn(),
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

function createMockSupabase(data: unknown[]) {
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };

  const { createBrowserSupabaseClient } = jest.requireMock(
    "@repo/supabase/client",
  );

  createBrowserSupabaseClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data }),
      }),
    }),
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn(),
  });

  return { mockChannel };
}

describe("AlertPanel", () => {
  it("renders alerts for inactive machines", async () => {
    createMockSupabase([
      { id: "1", name: "Conveyor 1", active: false },
      { id: "2", name: "Conveyor 2", active: true },
    ]);

    render(<AlertPanel departmentId="dept-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Conveyor 1 is offline/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Conveyor 2/)).not.toBeInTheDocument();
  });

  it("shows all clear when no inactive machines", async () => {
    createMockSupabase([{ id: "1", name: "Conveyor 1", active: true }]);
    render(<AlertPanel departmentId="dept-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("All systems operational. No active alerts."),
      ).toBeInTheDocument();
    });
  });

  it("acknowledges an alert", async () => {
    createMockSupabase([{ id: "1", name: "Conveyor 1", active: false }]);
    render(<AlertPanel departmentId="dept-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Conveyor 1 is offline/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Acknowledge"));

    await waitFor(() => {
      expect(screen.queryByText("Acknowledge")).not.toBeInTheDocument();
    });
  });

  it("dismisses an alert", async () => {
    createMockSupabase([{ id: "1", name: "Conveyor 1", active: false }]);
    render(<AlertPanel departmentId="dept-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Conveyor 1 is offline/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(
        screen.queryByText(/Conveyor 1 is offline/),
      ).not.toBeInTheDocument();
    });
  });
});
