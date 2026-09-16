import { fireEvent, render, screen } from "@testing-library/react";
import { CommandBar } from "./CommandBar";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@repo/ui/lib/urls", () => ({
  getServiceUrls: () => ({ portal: "http://localhost:3000" }),
}));

jest.mock("~/app/actions", () => ({
  logout: jest.fn(() => Promise.resolve()),
}));

describe("CommandBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render modal by default", () => {
    render(<CommandBar />);
    expect(screen.queryByRole("dialog", { name: /command palette/i })).not.toBeInTheDocument();
  });

  it("opens modal on Cmd+K and closes on Escape", () => {
    render(<CommandBar />);

    // Open with Cmd+K
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();

    // Close with Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /command palette/i })).not.toBeInTheDocument();
  });

  it("opens modal on Ctrl+K and closes on backdrop click", () => {
    render(<CommandBar />);

    // Open with Ctrl+K
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const modal = screen.getByRole("dialog", { name: /command palette/i });
    expect(modal).toBeInTheDocument();

    // Click backdrop
    const backdrop = modal.querySelector(".bg-black\\/30");
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(screen.queryByRole("dialog", { name: /command palette/i })).not.toBeInTheDocument();
  });

  it("filters command items based on query input", () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText(/search departments, tools, or pages/i);
    fireEvent.change(input, { target: { value: "drilling" } });

    expect(screen.getByText("Drilling Operations")).toBeInTheDocument();
    expect(screen.queryByText("System Overview")).not.toBeInTheDocument();
  });

  it("navigates results with Arrow keys and selects with Enter", () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    // Press ArrowDown to move to next item
    fireEvent.keyDown(window, { key: "ArrowDown" });
    // Press Enter to select
    fireEvent.keyDown(window, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/drilling");
  });

  it("navigates on item button click", () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const item = screen.getByText("Production");
    fireEvent.click(item.closest("button")!);

    expect(mockPush).toHaveBeenCalledWith("/production");
  });
});
