import type { Meta, StoryObj } from "@storybook/react";
import { FlowEdge } from "./FlowEdge";
import { TriggerNode } from "../nodes/TriggerNode";
import { PluginNode } from "../nodes/PluginNode";
import { ReactFlow, Background, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React from "react";

const meta: Meta<typeof FlowEdge> = {
  title: "Industrial/Edges/FlowEdge",
  component: FlowEdge,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof FlowEdge>;

const nodeTypes = { trigger: TriggerNode, plugin: PluginNode };
const edgeTypes = { flow: FlowEdge };

const EdgeWrapper = (props: any) => (
  <div style={{ width: "100vw", height: "100vh" }}>
    <ReactFlow
      nodes={[
        {
          id: "1",
          type: "trigger",
          position: { x: 50, y: 100 },
          data: { label: "Start" },
        },
        {
          id: "2",
          type: "plugin",
          position: { x: 300, y: 100 },
          data: { label: "Action", pluginId: "test", config: {} },
        },
      ]}
      edges={[
        {
          id: "e1-2",
          source: "1",
          target: "2",
          type: "flow",
          selected: props.selected,
        },
      ]}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
    >
      <Background />
    </ReactFlow>
  </div>
);

export const Default: Story = {
  render: (args) => <EdgeWrapper {...args} />,
  args: {
    selected: false,
  },
};

export const Selected: Story = {
  render: (args) => <EdgeWrapper {...args} />,
  args: {
    selected: true,
  },
};
