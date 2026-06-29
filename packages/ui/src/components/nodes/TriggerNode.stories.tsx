import type { Meta, StoryObj } from "@storybook/react";
import { TriggerNode } from "./TriggerNode";
import { ReactFlow, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React from "react";

const meta: Meta<typeof TriggerNode> = {
  title: "Industrial/Nodes/TriggerNode",
  component: TriggerNode,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof TriggerNode>;

const nodeTypes = { trigger: TriggerNode };

const NodeWrapper = (props: any) => (
  <div style={{ width: "100vw", height: "100vh" }}>
    <ReactFlow
      nodes={[
        {
          id: "1",
          type: "trigger",
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
      label: "API Webhook",
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
