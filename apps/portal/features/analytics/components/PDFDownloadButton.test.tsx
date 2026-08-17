import { render, screen, fireEvent, act } from "@testing-library/react";
import { PDFDownloadButton } from "./PDFDownloadButton";

const mockGenerateMonthlyReport = jest.fn();
jest.mock("@/app/actions", () => ({
  generateMonthlyReport: (...args: unknown[]) => mockGenerateMonthlyReport(...args),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const reportData = {
  title: "Executive Report",
  subtitle: "Monthly summary",
  kpis: [{ label: "Tonnage", value: "1,000 t" }],
  tableHeaders: ["Date", "Coal"],
  tableRows: [["2026-08-01", "500"]],
};

describe("PDFDownloadButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the generated PDF and shows a success toast", async () => {
    mockGenerateMonthlyReport.mockResolvedValue({ success: true, url: "/reports/monthly.pdf" });

    render(<PDFDownloadButton reportData={reportData} departmentId="d1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));
    });

    expect(mockGenerateMonthlyReport).toHaveBeenCalledWith(reportData, "d1");
    expect(window.open).toHaveBeenCalledWith("/reports/monthly.pdf", "_blank");
    expect(mockToastSuccess).toHaveBeenCalledWith("PDF report generated successfully!");
  });

  it("shows an error toast when generation fails", async () => {
    mockGenerateMonthlyReport.mockResolvedValue({ success: false, url: null });

    render(<PDFDownloadButton reportData={reportData} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));
    });

    expect(mockToastError).toHaveBeenCalledWith("Failed to generate PDF report.");
    expect(window.open).not.toHaveBeenCalled();
  });

  it("shows an error toast when the action throws", async () => {
    mockGenerateMonthlyReport.mockRejectedValue(new Error("boom"));

    render(<PDFDownloadButton reportData={reportData} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));
    });

    expect(mockToastError).toHaveBeenCalledWith("An error occurred while generating the PDF.");
  });

  it("disables the button and shows a spinner while loading", async () => {
    let resolveFn: (_value: unknown) => void = () => {};
    mockGenerateMonthlyReport.mockImplementation(
      () => new Promise((resolve) => (resolveFn = resolve)),
    );

    render(<PDFDownloadButton reportData={reportData} />);
    fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));

    expect(screen.getByText("Generating PDF...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();

    await act(async () => {
      resolveFn({ success: true, url: "/x.pdf" });
    });
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });
});
