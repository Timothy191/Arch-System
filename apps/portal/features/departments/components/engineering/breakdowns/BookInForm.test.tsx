import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookInForm } from "./BookInForm";
import type { Breakdown, Machine } from "./types";

jest.mock("./actions", () => ({
  createBreakdown: jest.fn(),
}));

jest.mock("@repo/utils", () => ({
  triggerWorkflow: jest.fn(),
}));

const { createBreakdown } = jest.requireMock("./actions");

const MOCK_MACHINES: Machine[] = [
  {
    id: "m-1",
    name: "CAT 320D",
    machine_type: "Excavator",
    serial_number: "FL-001",
    active: true,
  },
  {
    id: "m-2",
    name: "Volvo A40G",
    machine_type: "Haul Truck",
    serial_number: "FL-002",
    active: true,
  },
];

const ACTIVE_BREAKDOWN: Breakdown = {
  id: "bd-1",
  department_id: "dept-eng",
  fleet_id: "FL-001",
  machine_name: "CAT 320D",
  machine_type: "Excavator",
  date_in: "2026-05-17",
  time_in: "08:00",
  date_out: null,
  time_out: null,
  reason: "Hydraulic failure",
  repair_notes: null,
  status: "active",
  missing_book_in: false,
  created_by: "emp-1",
  completed_by: null,
  deleted_at: null,
  created_at: "2026-05-17T08:00:00Z",
  updated_at: "2026-05-17T08:00:00Z",
};

describe("BookInForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createBreakdown.mockResolvedValue(undefined);
  });

  it("renders form fields and book in button", () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[]}
        machines={MOCK_MACHINES}
      />,
    );

    expect(screen.getByLabelText(/Select Machine/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date In/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Time In/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Describe the issue/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Book In Machine/i }),
    ).toBeInTheDocument();
  });

  it("shows 'No active breakdowns' when activeBreakdowns is empty", () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[]}
        machines={MOCK_MACHINES}
      />,
    );
    expect(screen.getByText(/No active breakdowns/i)).toBeInTheDocument();
  });

  it("renders active breakdowns in the table", () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[ACTIVE_BREAKDOWN]}
        machines={MOCK_MACHINES}
      />,
    );

    expect(screen.getByText("FL-001")).toBeInTheDocument();
    expect(screen.getByText("CAT 320D")).toBeInTheDocument();
    expect(screen.getAllByText("Excavator").length).toBeGreaterThanOrEqual(1);
  });

  it("shows count of active breakdowns", () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[ACTIVE_BREAKDOWN]}
        machines={MOCK_MACHINES}
      />,
    );
    expect(screen.getByText("1 machines")).toBeInTheDocument();
  });

  it("shows error when machine is not selected on submit", async () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[]}
        machines={MOCK_MACHINES}
      />,
    );

    fireEvent.submit(
      screen.getByRole("button", { name: /Book In Machine/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(screen.getByText("Please select a machine")).toBeInTheDocument();
    });
    expect(createBreakdown).not.toHaveBeenCalled();
  });

  it("shows error when reason is too short", async () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[]}
        machines={MOCK_MACHINES}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Select Machine/i), {
      target: { value: "m-1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Book In Machine/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Reason must be at least 5 characters"),
      ).toBeInTheDocument();
    });
    expect(createBreakdown).not.toHaveBeenCalled();
  });

  it("submits successfully and shows success message", async () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[]}
        machines={MOCK_MACHINES}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Select Machine/i), {
      target: { value: "m-1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: "Hydraulic pump failure" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Book In Machine/i }));

    await waitFor(() => {
      expect(createBreakdown).toHaveBeenCalledWith(
        "dept-eng",
        expect.objectContaining({
          fleet_id: "FL-001",
          machine_name: "CAT 320D",
          machine_type: "Excavator",
          reason: "Hydraulic pump failure",
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Machine booked in successfully!"),
      ).toBeInTheDocument();
    });
  });

  it("shows error message when createBreakdown throws", async () => {
    createBreakdown.mockRejectedValueOnce(new Error("DB error"));

    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[]}
        machines={MOCK_MACHINES}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Select Machine/i), {
      target: { value: "m-1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: "Hydraulic pump failure" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Book In Machine/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to book in machine."),
      ).toBeInTheDocument();
    });
  });
});
