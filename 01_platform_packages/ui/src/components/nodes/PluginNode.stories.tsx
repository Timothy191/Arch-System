import type { Meta, StoryObj } from "@storybook/react";
import { PluginNode } from "./PluginNode";
import { ReactFlow, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React from "react";

const meta: Meta<typeof PluginNode> = {
  title: "Industrial/Nodes/PluginNode",
  component: PluginNode,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof PluginNode>;

const nodeTypes = { plugin: PluginNode };

const NodeWrapper = (props: any) => (
  <div style={{ width: "100vw", height: "100vh" }}>
    <ReactFlow
      nodes={[
        {
          id: "1",
          type: "plugin",
          position: { x: 100, y: 100 },
          data: props.data,
          selected: props.selected,
        },
      ]}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
    </ReactFlow>
  </div>
);

export const Default: Story = {
  render: (args) => <NodeWrapper {...args} />,
  args: {
    data: {
      label: "Process Telemetry",
      pluginId: "telemetry-v2",
      config: { retry: 3 },
    },
    selected: false,
  },
};

export const Selected: Story = {
  render: (args) => <NodeWrapper {...args} />,
  args: {
    ...Default.args,
    selected: true,
  },
};
