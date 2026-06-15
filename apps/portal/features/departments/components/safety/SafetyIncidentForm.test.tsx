import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { SafetyIncidentForm } from "./SafetyIncidentForm";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    refresh: jest.fn(),
  })),
}));

jest.mock("@repo/supabase/client", () => ({
  createBrowserSupabaseClient: jest.fn(),
}));

jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="glass-card">{children}</div>
  ),
}));

const { createBrowserSupabaseClient } = jest.requireMock(
  "@repo/supabase/client",
);

describe("SafetyIncidentForm", () => {
  const categories = [
    { id: "cat-1", name: "Slip / Fall", color: "#ff0000", icon: "alert" },
    { id: "cat-2", name: "Equipment", color: "#00ff00", icon: "wrench" },
  ];

  const severities = [
    { id: "sev-1", level: "Low", color: "#00ff00" },
    { id: "sev-2", level: "High", color: "#ff0000" },
  ];

  function fillRequiredFields() {
    fireEvent.change(screen.getByLabelText(/Type/i), {
      target: { value: "near-miss" },
    });
    fireEvent.change(screen.getByLabelText(/Severity Level/i), {
      target: { value: "sev-1" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "Worker slipped on wet floor" },
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders form fields", () => {
    render(
      <SafetyIncidentForm
        departmentId="dept-1"
        categories={categories}
        severities={severities}
      />,
    );

    expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Severity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Log Incident/i }),
    ).toBeInTheDocument();
  });

  it("validates required fields on submit", async () => {
    render(
      <SafetyIncidentForm
        departmentId="dept-1"
        categories={categories}
        severities={severities}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Log Incident/i }));

    await waitFor(() => {
      expect(screen.getByText("Select incident type")).toBeInTheDocument();
      expect(screen.getByText("Select severity")).toBeInTheDocument();
      expect(screen.getByText("Enter description")).toBeInTheDocument();
    });
  });

  it("submits successfully and resets form", async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: "emp-1" },
    });
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: "auth-1" } },
    });

    createBrowserSupabaseClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "employees") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        if (table === "safety_incidents") {
          return { insert: mockInsert };
        }
        return { insert: jest.fn(), select: jest.fn() };
      }),
    });

    render(
      <SafetyIncidentForm
        departmentId="dept-1"
        categories={categories}
        severities={severities}
      />,
    );

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Location/i), {
      target: { value: "Main Pit" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Log Incident/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.department_id).toBe("dept-1");
    expect(insertCall.incident_type).toBe("near-miss");
    expect(insertCall.severity_id).toBe("sev-1");
    expect(insertCall.description).toBe("Worker slipped on wet floor");
    expect(insertCall.location).toBe("Main Pit");
    expect(insertCall.reported_by).toBe("emp-1");

    // Form should reset after success
    await waitFor(() => {
      expect(screen.getByLabelText(/Type/i)).toHaveValue("");
    });
  });

  it("shows error when submission fails", async () => {
    const mockInsert = jest
      .fn()
      .mockResolvedValue({ error: { message: "DB error" } });
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: "emp-1" },
    });
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: "auth-1" } },
    });

    createBrowserSupabaseClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "employees") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        if (table === "safety_incidents") {
          return { insert: mockInsert };
        }
        return { insert: jest.fn(), select: jest.fn() };
      }),
    });

    render(
      <SafetyIncidentForm
        departmentId="dept-1"
        categories={categories}
        severities={severities}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /Log Incident/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to save incident. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("shows loading state while submitting", async () => {
    let resolveInsert: ((_value: { error: null }) => void) | null = null;
    const insertPromise = new Promise<{ error: null }>((resolve) => {
      resolveInsert = resolve;
    });

    const mockInsert = jest.fn().mockReturnValue(insertPromise);
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: "emp-1" },
    });
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: "auth-1" } },
    });

    createBrowserSupabaseClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "employees") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        if (table === "safety_incidents") {
          return { insert: mockInsert };
        }
        return { insert: jest.fn(), select: jest.fn() };
      }),
    });

    render(
      <SafetyIncidentForm
        departmentId="dept-1"
        categories={categories}
        severities={severities}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /Log Incident/i }));

    // Check for loading state - button should show "Saving..." and be disabled
    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Saving/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    // Resolve the insert to clean up inside act to avoid state update warnings
    await act(async () => {
      resolveInsert!({ error: null });
    });
  });

  it("validates injured parties range", async () => {
    render(
      <SafetyIncidentForm
        departmentId="dept-1"
        categories={categories}
        severities={severities}
      />,
    );

    // Fill required fields first so injured parties validation is reached
    fillRequiredFields();

    fireEvent.change(screen.getByLabelText(/Injured Parties/i), {
      target: { value: "-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Log Incident/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid number")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Injured Parties/i), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Log Incident/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid number")).toBeInTheDocument();
    });
  });
});
