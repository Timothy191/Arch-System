import type { Meta, StoryObj } from "@storybook/react";
import { ShiftToggle } from "./ShiftToggle";
import React, { useState } from "react";

const meta: Meta<typeof ShiftToggle> = {
  title: "Components/ShiftToggle",
  component: ShiftToggle,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof ShiftToggle>;

const ShiftToggleWithState = () => {
  const [value, setValue] = useState<"day" | "night">("day");
  return (
    <div className="w-64">
      <ShiftToggle value={value} onChange={setValue} />
    </div>
  );
};

export const Default: Story = {
  render: () => <ShiftToggleWithState />,
};

export const Day: Story = {
  args: {
    value: "day",
    onChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};

export const Night: Story = {
  args: {
    value: "night",
    onChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};
