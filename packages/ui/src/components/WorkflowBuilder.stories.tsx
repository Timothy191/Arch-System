import type { Meta, StoryObj } from "@storybook/react";
import { WorkflowBuilder } from "./WorkflowBuilder";
import React from "react";

const meta: Meta<typeof WorkflowBuilder> = {
  title: "Industrial/WorkflowBuilder",
  component: WorkflowBuilder,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof WorkflowBuilder>;

export const Default: Story = {
  args: {
    className: "h-[600px] w-full",
  },
};

export const ComplexWorkflow: Story = {
  args: {
    initialNodes: [
      {
        id: "start",
        type: "trigger",
        position: { x: 50, y: 150 },
        data: { label: "Sensor Trigger" },
      },
      {
        id: "p1",
        type: "plugin",
        position: { x: 250, y: 150 },
        data: {
          label: "Data Sanitization",
          pluginId: "cleaner-v1",
          config: {},
        },
      },
      {
        id: "p2",
        type: "plugin",
        position: { x: 500, y: 50 },
        data: {
          label: "AI Analysis",
          pluginId: "gpt-eval",
          config: { temp: 0.7 },
        },
      },
      {
        id: "p3",
        type: "plugin",
        position: { x: 500, y: 250 },
        data: { label: "Log Storage", pluginId: "db-writer", config: {} },
      },
    ],
    initialEdges: [
      { id: "e1", source: "start", target: "p1", type: "flow" },
      { id: "e2", source: "p1", target: "p2", type: "flow" },
      { id: "e3", source: "p1", target: "p3", type: "flow" },
    ],
    onSave: (n, e) => console.log("Saved", { n, e }),
    onExecute: async () => new Promise((resolve) => setTimeout(resolve, 2000)),
  },
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
  },
};
