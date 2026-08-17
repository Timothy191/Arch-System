import { render, screen } from "@testing-library/react";
import { ReportTemplate } from "./ReportTemplate";

// @react-pdf/renderer is ESM-only and cannot be parsed by Jest — render
// lightweight stubs instead (same pattern as printing.test.ts).
jest.mock("@react-pdf/renderer", () => {
  const React = require("react");
  return {
    Document: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="pdf-document">{children}</div>
    ),
    Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

const data = {
  title: "Executive Production & Fleet Report",
  subtitle: "Generated on 2026-08-17 — Month-to-date analysis",
  kpis: [
    { label: "Total Tonnage", value: "12,340 t" },
    { label: "Coal Removed", value: "9,100 t" },
  ],
  tableHeaders: ["Date", "Coal (t)", "Waste (t)"],
  tableRows: [
    ["2026-08-17", "500", "120"],
    ["2026-08-18", "480", "110"],
  ],
};

describe("ReportTemplate", () => {
  it("renders the title, subtitle, and section headings", () => {
    render(<ReportTemplate data={data} />);
    expect(screen.getByText("Executive Production & Fleet Report")).toBeInTheDocument();
    expect(
      screen.getByText("Generated on 2026-08-17 — Month-to-date analysis"),
    ).toBeInTheDocument();
    expect(screen.getByText("Key Performance Indicators")).toBeInTheDocument();
    expect(screen.getByText("Operational Details")).toBeInTheDocument();
  });

  it("renders KPI labels and values", () => {
    render(<ReportTemplate data={data} />);
    expect(screen.getByText("Total Tonnage")).toBeInTheDocument();
    expect(screen.getByText("12,340 t")).toBeInTheDocument();
    expect(screen.getByText("Coal Removed")).toBeInTheDocument();
    expect(screen.getByText("9,100 t")).toBeInTheDocument();
  });

  it("renders table headers and rows", () => {
    render(<ReportTemplate data={data} />);
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Coal (t)")).toBeInTheDocument();
    expect(screen.getByText("Waste (t)")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("480")).toBeInTheDocument();
  });

  it("omits the operational details section when there are no rows", () => {
    render(<ReportTemplate data={{ ...data, tableRows: [] }} />);
    expect(screen.queryByText("Operational Details")).toBeNull();
  });
});
