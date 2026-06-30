import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskbarSearch } from "./TaskbarSearch";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("TaskbarSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("searches Arch data after debounce", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: "drill",
        results: [
          {
            id: "dept-1",
            category: "department",
            title: "Drilling Operations",
            subtitle: "drilling",
            href: "/drilling",
          },
        ],
      }),
    });

    render(<TaskbarSearch />);

    fireEvent.change(screen.getByRole("combobox", { name: "Search Arch" }), {
      target: { value: "drill" },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/search?q=drill",
        expect.objectContaining({ cache: "no-store" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Drilling Operations")).toBeInTheDocument();
    });
  });

  it("navigates to result on Enter", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: "prod",
        results: [
          {
            id: "dept-2",
            category: "department",
            title: "Production",
            subtitle: "production",
            href: "/production",
          },
        ],
      }),
    });

    render(<TaskbarSearch />);

    const input = screen.getByRole("combobox", { name: "Search Arch" });
    fireEvent.change(input, { target: { value: "prod" } });

    await waitFor(() => {
      expect(screen.getByText("Production")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/production");
  });
});
