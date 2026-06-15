import { render, screen, waitFor, act } from "@testing-library/react";
import { ScadaPanel } from "./ScadaPanel";

jest.mock("@repo/supabase/client", () => ({
  createBrowserSupabaseClient: jest.fn(),
}));

jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="glass-card">{children}</div>
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
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn(),
  });

  return { mockChannel };
}

describe("ScadaPanel", () => {
  it("renders machine cards with status", async () => {
    const machines = [
      {
        id: "1",
        name: "Drill A",
        machine_type: "drill",
        serial_number: "SN-001",
        active: true,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        name: "Drill B",
        machine_type: "drill",
        serial_number: null,
        active: false,
        created_at: "2024-01-02",
      },
    ];

    createMockSupabase(machines);
    render(<ScadaPanel departmentId="dept-1" />);

    await waitFor(() => {
      expect(screen.getByText("Drill A")).toBeInTheDocument();
    });

    expect(screen.getByText("Drill B")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("shows empty state when no machines", async () => {
    createMockSupabase([]);
    render(<ScadaPanel departmentId="dept-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("No machines registered for this department."),
      ).toBeInTheDocument();
    });
  });

  it("updates machine list on real-time insert", async () => {
    const machines = [
      {
        id: "1",
        name: "Drill A",
        machine_type: "drill",
        serial_number: null,
        active: true,
        created_at: "2024-01-01",
      },
    ];

    const { mockChannel } = createMockSupabase(machines);
    render(<ScadaPanel departmentId="dept-1" />);

    await waitFor(() => {
      expect(screen.getByText("Drill A")).toBeInTheDocument();
    });

    // Simulate a real-time INSERT event via the callback registered on .on()
    const onCallback = mockChannel.on.mock.calls[0][2];
    await act(async () => {
      onCallback({
        eventType: "INSERT",
        new: {
          id: "2",
          name: "Pump X",
          machine_type: "pump",
          serial_number: null,
          active: false,
          created_at: "2024-01-03",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Pump X")).toBeInTheDocument();
    });
  });
});
