// AGENT-TRACE: DozerRollForm test suite covering all states: closed/open toggle,
// initial guard, empty dozers, date display, area calculation, client-side
// validation, Zod schema validation, successful submission, submission error,
// and saving indicator.
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { DozerRollForm } from "./DozerRollForm";

// --- Mocks ---

jest.mock("next/navigation", () => {
  const refresh = jest.fn();
  return {
    useRouter: () => ({ refresh }),
  };
});

jest.mock("@repo/supabase/client", () => ({
  createBrowserSupabaseClient: jest.fn(),
}));

jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

jest.mock("@repo/ui/ShiftToggle", () => ({
  ShiftToggle: ({
    value: _value,
    onChange,
  }: {
    value: "day" | "night";
    onChange: (_v: "day" | "night") => void;
  }) => (
    <div data-testid="shift-toggle">
      <button data-testid="shift-day" onClick={() => onChange("day")}>
        Day
      </button>
      <button data-testid="shift-night" onClick={() => onChange("night")}>
        Night
      </button>
    </div>
  ),
}));

jest.mock("@repo/utils", () => ({
  getCurrentShift: () => "day",
}));

jest.mock("lucide-react", () => ({
  Plus: () => <div data-testid="icon-plus" />,
  X: () => <div data-testid="icon-x" />,
  Equal: () => <div data-testid="icon-equal" />,
  Calculator: () => <div data-testid="icon-calculator" />,
}));

// --- Types ---

interface DozerWithSite {
  id: string;
  name: string;
  serial_number: string | null;
  site_id: string | null;
  sites: { name: string }[] | null;
}

// --- Test Data ---

const mockDozers: DozerWithSite[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "D10T",
    serial_number: "ABC-123",
    site_id: "site-1",
    sites: [{ name: "Pit A" }],
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    name: "D9R",
    serial_number: "DEF-456",
    site_id: "site-1",
    sites: [{ name: "Pit A" }],
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    name: "D11T",
    serial_number: null,
    site_id: null,
    sites: null,
  },
];

const defaultProps = {
  departmentId: "550e8400-e29b-41d4-a716-446655440000",
  dozers: mockDozers,
  today: "2026-06-15",
};

const { createBrowserSupabaseClient } = jest.requireMock("@repo/supabase/client");

// --- Helper ---

/** Opens the form by clicking "Add Roll". Must be called after render. */
function openForm() {
  fireEvent.click(screen.getByRole("button", { name: /add roll/i }));
}

// --- Tests ---

describe("DozerRollForm", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  // ── 1. Closed state ────────────────────────────────────────────────────

  it("renders 'Add Roll' button in closed state", () => {
    render(<DozerRollForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: /add roll/i })).toBeInTheDocument();
    expect(screen.getByText("Add Roll")).toBeInTheDocument();

    // Form elements must NOT be present
    expect(screen.queryByText("Record Dozer Roll")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Length (m)")).not.toBeInTheDocument();
  });

  // ── 2. Open form ───────────────────────────────────────────────────────

  it("opens form when 'Add Roll' is clicked", () => {
    render(<DozerRollForm {...defaultProps} />);

    openForm();

    expect(screen.getByText("Record Dozer Roll")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Length (m)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Width (m)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 12")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 8")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 8.5")).toBeInTheDocument();
    expect(screen.getByTestId("shift-toggle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save roll/i })).toBeInTheDocument();

    // "Add Roll" must be hidden while form is open
    expect(screen.queryByText("Add Roll")).not.toBeInTheDocument();
  });

  // ── 3. Cancel closes form ──────────────────────────────────────────────

  it("cancel closes the form", () => {
    render(<DozerRollForm {...defaultProps} />);

    openForm();
    expect(screen.getByText("Record Dozer Roll")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByText("Record Dozer Roll")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add roll/i })).toBeInTheDocument();
  });

  // ── 4. Invalid today date guard ───────────────────────────────────────

  it("shows error for invalid/missing today date", () => {
    render(
      <DozerRollForm
        departmentId={defaultProps.departmentId}
        dozers={defaultProps.dozers}
        today=""
      />,
    );

    expect(screen.getByTestId("glass-card")).toBeInTheDocument();
    expect(
      screen.getByText("Operational date is missing or invalid. Please reload the page."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Add Roll")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  // ── 5. Empty dozers list ───────────────────────────────────────────────

  it("renders with empty dozers list", () => {
    render(
      <DozerRollForm
        departmentId={defaultProps.departmentId}
        dozers={[]}
        today={defaultProps.today}
      />,
    );

    openForm();

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Select dozer...")).toBeInTheDocument();
    // Only the placeholder option should exist
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  // ── 6. Operational date display ────────────────────────────────────────

  it("displays operational date", () => {
    render(<DozerRollForm {...defaultProps} />);

    openForm();

    expect(screen.getByText(/2026-06-15 \(Africa\/Johannesburg\)/)).toBeInTheDocument();
  });

  // ── 7. Area calculation ────────────────────────────────────────────────

  it("calculates area from length x width", () => {
    render(<DozerRollForm {...defaultProps} />);

    openForm();

    // Initially the site display and area display both show a dash
    expect(screen.getAllByText("—")).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText("Length (m)"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByPlaceholderText("Width (m)"), {
      target: { value: "10" },
    });

    expect(screen.getByText("150.00 m²")).toBeInTheDocument();
  });

  // ── 8. Validation: no dozer selected ───────────────────────────────────

  it("shows validation error when no dozer selected", async () => {
    render(<DozerRollForm {...defaultProps} />);

    openForm();

    fireEvent.click(screen.getByRole("button", { name: /save roll/i }));

    await waitFor(() => {
      expect(screen.getByText("Select a dozer")).toBeInTheDocument();
    });
  });

  // ── 9. Validation: length/width missing ────────────────────────────────

  it("shows validation error when length/width missing", async () => {
    render(<DozerRollForm {...defaultProps} />);

    openForm();

    // Select a dozer first so the machineId guard passes
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: mockDozers[0]!.id },
    });

    // Submit without entering length or width
    fireEvent.click(screen.getByRole("button", { name: /save roll/i }));

    await waitFor(() => {
      expect(screen.getByText("Enter both length and width")).toBeInTheDocument();
    });
  });

  // ── 10. Zod validation: invalid departmentId ────────────────────────────

  it("shows Zod validation error for invalid departmentId", async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    createBrowserSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({ insert: mockInsert })),
    });

    render(<DozerRollForm departmentId="not-a-uuid" dozers={mockDozers} today="2026-06-15" />);

    openForm();

    // Fill all client-side required fields so guards pass
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: mockDozers[0]!.id },
    });
    fireEvent.change(screen.getByPlaceholderText("Length (m)"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByPlaceholderText("Width (m)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 12"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8.5"), {
      target: { value: "8.5" },
    });

    // Submit — client-side guards pass, but Zod should reject non-UUID departmentId
    fireEvent.click(screen.getByRole("button", { name: /save roll/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid department ID")).toBeInTheDocument();
    });

    // Form stays open for retry
    expect(screen.getByText("Record Dozer Roll")).toBeInTheDocument();
  });

  // ── 11. Successful submission ──────────────────────────────────────────

  it("successful submission resets form", async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });

    createBrowserSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({
        insert: mockInsert,
      })),
    });

    render(<DozerRollForm {...defaultProps} />);

    openForm();

    // Select dozer
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: mockDozers[0]!.id },
    });

    // Enter dimensions (triggers area calculation)
    fireEvent.change(screen.getByPlaceholderText("Length (m)"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByPlaceholderText("Width (m)"), {
      target: { value: "10" },
    });

    // Enter roll metrics
    fireEvent.change(screen.getByPlaceholderText("e.g. 12"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8.5"), {
      target: { value: "8.5" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /save roll/i }));

    // Wait for the insert call
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    // Verify correct data was sent to the database
    expect(mockInsert).toHaveBeenCalledWith({
      department_id: "550e8400-e29b-41d4-a716-446655440000",
      machine_id: "550e8400-e29b-41d4-a716-446655440001",
      roll_date: "2026-06-15",
      shift_type: "day",
      blade_passes: 5,
      push_count: 3,
      hours_operated: 8.5,
      area_covered_sqm: 150,
      notes: "Length: 15m, Width: 10m",
    });

    // Verify router.refresh was called
    const { useRouter } = jest.requireMock("next/navigation");
    expect(useRouter().refresh).toHaveBeenCalledTimes(1);

    // Verify the form resets to closed state
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add roll/i })).toBeInTheDocument();
    });
    expect(screen.queryByText("Record Dozer Roll")).not.toBeInTheDocument();
  });

  // ── 12. Submission error ───────────────────────────────────────────────

  it("shows submission error", async () => {
    const testError = new Error("Test submission error");
    const mockInsert = jest.fn().mockRejectedValue(testError);

    createBrowserSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({
        insert: mockInsert,
      })),
    });

    render(<DozerRollForm {...defaultProps} />);

    openForm();

    // Fill required fields
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: mockDozers[0]!.id },
    });
    fireEvent.change(screen.getByPlaceholderText("Length (m)"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByPlaceholderText("Width (m)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 12"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8.5"), {
      target: { value: "8.5" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /save roll/i }));

    // Verify the error message is displayed
    await waitFor(() => {
      expect(screen.getByText("Test submission error")).toBeInTheDocument();
    });

    // Form stays open so user can retry
    expect(screen.getByText("Record Dozer Roll")).toBeInTheDocument();
  });

  // ── 13. "Saving..." during submission ──────────────────────────────────

  it("shows 'Saving...' during submission", async () => {
    let _resolveInsert: ((_value: { error: null }) => void) | null = null;
    const insertPromise = new Promise<{ error: null }>((resolve) => {
      _resolveInsert = resolve;
    });
    const mockInsert = jest.fn().mockReturnValue(insertPromise);

    createBrowserSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({
        insert: mockInsert,
      })),
    });

    render(<DozerRollForm {...defaultProps} />);

    openForm();

    // Fill required fields
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: mockDozers[0]!.id },
    });
    fireEvent.change(screen.getByPlaceholderText("Length (m)"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByPlaceholderText("Width (m)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 12"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8.5"), {
      target: { value: "8.5" },
    });

    // Submit — the promise never resolves, keeping isSubmitting true
    fireEvent.click(screen.getByRole("button", { name: /save roll/i }));

    await waitFor(() => {
      const savingBtn = screen.getByRole("button", { name: /saving/i });
      expect(savingBtn).toBeInTheDocument();
      expect(savingBtn).toBeDisabled();
    });

    // Resolve to clean up async state
    await act(async () => {
      _resolveInsert!({ error: null });
    });
  });
});
