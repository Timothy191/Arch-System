import { act, render, screen } from "@testing-library/react";
import { LoginServiceStatusBanner } from "./LoginServiceStatusBanner";

describe("LoginServiceStatusBanner", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it("renders the first service slot after health resolves", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        status: "healthy",
        services: {
          database: { status: "healthy" },
          redis: { status: "healthy" },
          fuxa: { status: "degraded" },
        },
      }),
    });

    render(<LoginServiceStatusBanner />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Supabase Checking…");

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Supabase Online");
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("rotates to Redis on the next interval", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        status: "healthy",
        services: {
          database: { status: "healthy" },
          redis: { status: "degraded" },
          fuxa: { status: "healthy" },
        },
      }),
    });

    render(<LoginServiceStatusBanner />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(3_500);
    });

    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Redis Degraded");
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("shows offline state when health fetch fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network"));

    render(<LoginServiceStatusBanner />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Supabase Offline");
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });
});
