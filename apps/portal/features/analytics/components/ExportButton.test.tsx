import { render, screen, fireEvent, act } from "@testing-library/react";
import { ExportButton } from "./ExportButton";

const mockExportToExcel = jest.fn();
jest.mock("@repo/utils/client", () => ({
  exportToExcel: (...args: unknown[]) => mockExportToExcel(...args),
}));

const createObjectURL = jest.fn();
const revokeObjectURL = jest.fn();
const anchorClick = jest.fn();
const originalCreateElement = document.createElement.bind(document);
const originalBlob = global.Blob;
const blobParts: string[][] = [];

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  // jsdom's Blob has no .text() — capture the parts instead.
  global.Blob = jest.fn((parts: string[]) => {
    blobParts.push(parts);
    return { size: 0 } as Blob;
  }) as unknown as typeof Blob;
  blobParts.length = 0;
  jest.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "a") {
      return { click: anchorClick, href: "", download: "" } as unknown as HTMLElement;
    }
    return originalCreateElement(tag);
  });
});

afterEach(() => {
  global.Blob = originalBlob;
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ExportButton", () => {
  it("is disabled when there are no rows", () => {
    render(<ExportButton filename="report" rows={[]} />);
    expect(screen.getByRole("button", { name: /Export Report/ })).toBeDisabled();
  });

  it("opens and closes the export menu", () => {
    render(<ExportButton filename="report" rows={[{ a: 1 }]} />);
    expect(screen.queryByText("Download CSV")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Export Report/ }));
    expect(screen.getByText("Download CSV")).toBeInTheDocument();
    expect(screen.getByText("Download Excel (.xlsx)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Export Report/ }));
    expect(screen.queryByText("Download CSV")).toBeNull();
  });

  it("closes the menu when clicking outside", () => {
    render(<ExportButton filename="report" rows={[{ a: 1 }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Export Report/ }));
    expect(screen.getByText("Download CSV")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Download CSV")).toBeNull();
  });

  it("exports CSV with quoted headers, escaped values, and the filename", async () => {
    render(
      <ExportButton
        filename="executive-report-2026-08-17"
        rows={[
          { date: "2026-08-17", note: 'he said "hi"' },
          { date: "2026-08-18", note: "plain" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Export Report/ }));
    fireEvent.click(screen.getByText("Download CSV"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(blobParts[0]![0]).toBe(
      '"date","note"\n"2026-08-17","he said ""hi"""\n"2026-08-18","plain"',
    );

    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("exports Excel via the shared util", async () => {
    render(<ExportButton filename="report" rows={[{ a: 1 }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Export Report/ }));

    await act(async () => {
      fireEvent.click(screen.getByText("Download Excel (.xlsx)"));
    });

    expect(mockExportToExcel).toHaveBeenCalledWith([{ a: 1 }], "report", "Sheet1");
    expect(screen.queryByText("Download CSV")).toBeNull();
  });
});
