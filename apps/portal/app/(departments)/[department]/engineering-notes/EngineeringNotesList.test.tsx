import React from "react";
import { render, screen } from "@testing-library/react";
import { EngineeringNotesList } from "./EngineeringNotesList";

jest.mock("@repo/ui/AnimatedList", () => ({
  AutoAnimateList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AnimatedList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

describe("EngineeringNotesList", () => {
  it("renders empty state when notes array is empty", () => {
    render(<EngineeringNotesList notes={[]} />);
    expect(screen.getByText("No engineering issues logged today.")).toBeInTheDocument();
  });

  it("renders day and night shift notes correctly", () => {
    const mockNotes = [
      {
        id: "note-1",
        shift_type: "day" as const,
        issue_type: "mechanical",
        severity: "critical" as const,
        machine_id: "m1",
        description: "Hydraulic hose leak on boom cylinder",
        action_taken: "Replaced main high-pressure line",
        requires_follow_up: true,
        status: "in_progress" as const,
        created_at: new Date().toISOString(),
        machine: {
          name: "EXC-001",
          sites: { name: "North Pit" },
        },
      },
      {
        id: "note-2",
        shift_type: "night" as const,
        issue_type: "electrical",
        severity: "medium" as const,
        machine_id: "m2",
        description: "Headlight wiring fault",
        action_taken: null,
        requires_follow_up: false,
        status: "open" as const,
        created_at: new Date().toISOString(),
        machine: {
          name: "DMP-002",
          sites: [{ name: "South Ridge" }],
        },
      },
    ];

    render(<EngineeringNotesList notes={mockNotes} />);

    // Shift headers
    expect(screen.getByText("Day Shift")).toBeInTheDocument();
    expect(screen.getByText("Night Shift")).toBeInTheDocument();

    // Note descriptions
    expect(screen.getByText("Hydraulic hose leak on boom cylinder")).toBeInTheDocument();
    expect(screen.getByText("Headlight wiring fault")).toBeInTheDocument();

    // Machine & site display
    expect(screen.getByText("EXC-001")).toBeInTheDocument();
    expect(screen.getByText("North Pit")).toBeInTheDocument();
    expect(screen.getByText("DMP-002")).toBeInTheDocument();
    expect(screen.getByText("South Ridge")).toBeInTheDocument();

    // Badges & status
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("IN PROGRESS")).toBeInTheDocument();
    expect(screen.getByText("Follow-up required")).toBeInTheDocument();
  });
});
