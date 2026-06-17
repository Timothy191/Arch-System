import type { Meta, StoryObj } from "@storybook/react";
import { Spotlight } from "./spotlight";
import React from "react";

const meta: Meta<typeof Spotlight> = {
  title: "Motion/Spotlight",
  component: Spotlight,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Spotlight>;

export const Default: Story = {
  render: (args) => (
    <div className="relative h-[400px] w-[600px] rounded-3xl border bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      <Spotlight {...args} />
      <h1 className="text-6xl font-black text-white/10 select-none tracking-tighter">
        SPOTLIGHT
      </h1>
      <p className="text-white/20 mt-4 select-none">
        Hover to reveal the hidden architecture
      </p>
    </div>
  ),
  args: {
    size: 300,
  },
};

export const Cyan: Story = {
  render: (args) => (
    <div className="relative h-[300px] w-[300px] rounded-xl border bg-black flex items-center justify-center overflow-hidden">
      <Spotlight
        {...args}
        className="from-accent-blue via-accent-blue/50 to-transparent"
      />
      <div className="w-16 h-16 rounded bg-white/5 border border-white/10" />
    </div>
  ),
  args: {
    size: 150,
  },
};
