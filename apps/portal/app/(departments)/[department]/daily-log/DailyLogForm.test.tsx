import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DailyLogForm } from "./DailyLogForm";

// Mock the Supabase client
jest.mock("@repo/supabase/client", () => ({
  createBrowserSupabaseClient: jest.fn(),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const { createBrowserSupabaseClient } = jest.requireMock(
  "@repo/supabase/client",
);

describe("DailyLogForm", () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "test-user-id" } } }),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createBrowserSupabaseClient.mockReturnValue(mockSupabase);
  });

  const props = {
    departmentId: "test-dept-id",
    departmentSlug: "mining",
    machines: [
      { id: "machine-1", name: "Excavator 1", machine_type: "excavator" },
      { id: "machine-2", name: "Truck 1", machine_type: "dump_truck" },
    ],
  };

  it("renders the form correctly", () => {
    render(<DailyLogForm {...props} />);

    // Check that the form renders
    expect(screen.getByText(/Save Daily Log/i)).toBeInTheDocument();

    // Check shift toggle text (buttons)
    expect(screen.getByText(/Day/i)).toBeInTheDocument();
    expect(screen.getByText(/Night/i)).toBeInTheDocument();

    // Check machines list
    expect(screen.getByText(/Excavator 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Truck 1/i)).toBeInTheDocument();

    // Check notes textarea
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
  });

  it("submits the form successfully", async () => {
    render(<DailyLogForm {...props} />);

    // Fill out the form (we need to interact with the actual form elements)
    // Note: This is simplified since we're using react-hook-form

    const submitButton = screen.getByRole("button", {
      name: /save daily log/i,
    });
    expect(submitButton).toBeEnabled();

    // Click submit
    fireEvent.click(submitButton);

    // Should show saving state
    expect(submitButton).toHaveTextContent(/saving/i);
    expect(submitButton).toBeDisabled();

    // Wait for success
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith("daily_logs");
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/log saved successfully/i)).toBeInTheDocument();
    });

    // Button should be enabled again
    expect(submitButton).toHaveTextContent(/save daily log/i);
    expect(submitButton).toBeEnabled();
  });

  it("handles submission errors", async () => {
    // Mock an error
    mockSupabase.from().insert.mockResolvedValueOnce({
      error: { message: "Database error" },
    });

    render(<DailyLogForm {...props} />);

    const submitButton = screen.getByRole("button", {
      name: /save daily log/i,
    });
    fireEvent.click(submitButton);

    // Should show saving state
    expect(submitButton).toHaveTextContent(/saving/i);
    expect(submitButton).toBeDisabled();

    // Wait for error
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith("daily_logs");
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to save log/i)).toBeInTheDocument();
    });

    // Button should be enabled again
    expect(submitButton).toHaveTextContent(/save daily log/i);
    expect(submitButton).toBeEnabled();
  });
});
