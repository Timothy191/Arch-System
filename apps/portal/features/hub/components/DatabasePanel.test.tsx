import { render, screen, fireEvent } from "@testing-library/react";
import { DatabasePanel } from "./DatabasePanel";

const openMock = jest.fn();
const originalOpen = window.open;

describe("DatabasePanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.open = openMock;
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  it("opens Supabase Studio in a new tab when clicked", () => {
    render(<DatabasePanel />);

    fireEvent.click(screen.getByTestId("database-panel"));

    expect(openMock).toHaveBeenCalledWith(
      expect.stringMatching(/54323|supabase\.com\/dashboard/),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens Supabase Studio on Enter key", () => {
    render(<DatabasePanel />);

    const panel = screen.getByTestId("database-panel");
    fireEvent.keyDown(panel, { key: "Enter" });

    expect(openMock).toHaveBeenCalledTimes(1);
  });
});
