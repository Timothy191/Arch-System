import type { Meta, StoryObj } from "@storybook/react";
import { ShineBorder } from "./shine-border";
import React from "react";

const meta: Meta<typeof ShineBorder> = {
  title: "UI/ShineBorder",
  component: ShineBorder,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    borderWidth: { control: { type: "range", min: 1, max: 10 } },
    duration: { control: { type: "range", min: 1, max: 30 } },
  },
};

export default meta;

type Story = StoryObj<typeof ShineBorder>;

export const Default: Story = {
  render: (args) => (
    <div className="relative flex h-[200px] w-[300px] flex-col items-center justify-center overflow-hidden rounded-xl border bg-background md:shadow-xl">
      <span className="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-4xl font-semibold leading-none text-transparent">
        Shine Border
      </span>
      <ShineBorder {...args} />
    </div>
  ),
  args: {
    shineColor: ["#A0A0A0", "#FFFFFF", "#A0A0A0"],
    borderWidth: 1,
    duration: 14,
  },
};

export const CyanGlow: Story = {
  render: (args) => (
    <div className="relative flex h-[200px] w-[300px] flex-col items-center justify-center overflow-hidden rounded-xl border bg-black md:shadow-xl">
      <span className="text-white font-mono uppercase tracking-widest">Active System</span>
      <ShineBorder {...args} />
    </div>
  ),
  args: {
    shineColor: ["#00d4aa", "#007aff", "#00d4aa"],
    borderWidth: 2,
    duration: 8,
  },
};
