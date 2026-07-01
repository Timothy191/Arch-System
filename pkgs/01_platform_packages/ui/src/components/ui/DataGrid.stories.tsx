import type { Meta, StoryObj } from "@storybook/react";
import { DataGrid } from "./data-grid";
import React from "react";

const meta: Meta<typeof DataGrid> = {
  title: "UI/DataGrid",
  component: DataGrid,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof DataGrid>;

const sampleColumns = [
  {
    prop: "id",
    name: "ID",
    size: 100,
  },
  {
    prop: "machine",
    name: "Machine Name",
    size: 200,
  },
  {
    prop: "status",
    name: "Status",
    size: 150,
  },
  {
    prop: "lastMaintenance",
    name: "Last Maintenance",
    size: 180,
  },
  {
    prop: "efficiency",
    name: "Efficiency (%)",
    size: 120,
  },
];

const sampleSource = [
  {
    id: "M001",
    machine: "Drill Rig A",
    status: "Operational",
    lastMaintenance: "2026-05-12",
    efficiency: 94,
  },
  {
    id: "M002",
    machine: "Excavator X2",
    status: "Maintenance",
    lastMaintenance: "2026-06-10",
    efficiency: 0,
  },
  {
    id: "M003",
    machine: "Haul Truck T5",
    status: "Operational",
    lastMaintenance: "2026-04-22",
    efficiency: 88,
  },
  {
    id: "M004",
    machine: "Crusher C1",
    status: "Alert",
    lastMaintenance: "2026-06-01",
    efficiency: 72,
  },
  {
    id: "M005",
    machine: "Drill Rig B",
    status: "Operational",
    lastMaintenance: "2026-05-28",
    efficiency: 91,
  },
];

export const Default: Story = {
  args: {
    columns: sampleColumns,
    source: sampleSource,
    height: "400px",
    sorting: true,
    filter: true,
  },
};

export const LargeDataset: Story = {
  args: {
    columns: sampleColumns,
    source: Array.from({ length: 100 }).map((_, i) => ({
      id: `M${String(i + 1).padStart(3, "0")}`,
      machine: `Unit ${i + 1}`,
      status: i % 4 === 0 ? "Maintenance" : "Operational",
      lastMaintenance: "2026-06-15",
      efficiency: Math.floor(Math.random() * 100),
    })),
    height: "500px",
    sorting: true,
    filter: true,
  },
};
