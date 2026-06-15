import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { ControlRoomActivityFeed } from "./ControlRoomActivityFeed";

jest.mock("@repo/supabase/client", () => ({
  createBrowserSupabaseClient: jest.fn(),
}));

jest.mock("@repo/ui/AnimatedList", () => ({
  AnimatedFeed: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="animated-feed" className={className}>
      {children}
    </div>
  ),
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

function createMockSupabase() {
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };

  const { createBrowserSupabaseClient } = jest.requireMock(
    "@repo/supabase/client",
  );

  createBrowserSupabaseClient.mockReturnValue({
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn(),
  });

  return { mockChannel };
}

describe("ControlRoomActivityFeed", () => {
  it("renders waiting state initially", () => {
    createMockSupabase();
    render(<ControlRoomActivityFeed departmentId="dept-1" />);

    expect(screen.getByText("Waiting for activity...")).toBeInTheDocument();
  });

  it("displays activities from real-time events", async () => {
    const { mockChannel } = createMockSupabase();
    render(<ControlRoomActivityFeed departmentId="dept-1" />);

    const onCallback = mockChannel.on.mock.calls[0][2];

    await act(async () => {
      onCallback({
        eventType: "INSERT",
        new: { name: "Crusher 1" },
        commit_timestamp: "2024-01-01T00:00:00Z",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Crusher 1 registered/)).toBeInTheDocument();
    });
  });

  it("filters activities by type", async () => {
    const { mockChannel } = createMockSupabase();
    render(<ControlRoomActivityFeed departmentId="dept-1" />);

    const onCallback = mockChannel.on.mock.calls[0][2];

    await act(async () => {
      onCallback({
        eventType: "INSERT",
        new: { name: "Crusher 1" },
        commit_timestamp: "2024-01-01T00:00:00Z",
      });
    });

    await act(async () => {
      onCallback({
        eventType: "UPDATE",
        new: { name: "Crusher 1" },
        commit_timestamp: "2024-01-01T00:01:00Z",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Crusher 1 registered/)).toBeInTheDocument();
      expect(screen.getByText(/Crusher 1 updated/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("insert"));

    await waitFor(() => {
      expect(screen.queryByText(/Crusher 1 updated/)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Crusher 1 registered/)).toBeInTheDocument();
  });
});
