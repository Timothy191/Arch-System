import type { Meta, StoryObj } from "@storybook/react";
import { GlowEffect } from "./glow-effect";
import React from "react";

const meta: Meta<typeof GlowEffect> = {
  title: "Motion/GlowEffect",
  component: GlowEffect,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    mode: {
      control: "select",
      options: ["rotate", "pulse", "breathe", "colorShift", "flowHorizontal", "static"],
    },
    blur: {
      control: "select",
      options: ["softest", "soft", "medium", "strong", "stronger", "strongest", "none"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof GlowEffect>;

export const Default: Story = {
  render: (args) => (
    <div className="relative w-64 h-64 flex items-center justify-center bg-black rounded-3xl overflow-hidden shadow-window">
      <GlowEffect {...args} />
      <div className="relative z-10 text-white font-bold text-xl">ARCH CORE</div>
    </div>
  ),
  args: {
    colors: ["#00d4aa", "#007aff", "#5856d6", "#00d4aa"],
    mode: "rotate",
    blur: "strong",
    duration: 5,
  },
};

export const Pulse: Story = {
  render: (args) => (
    <div className="relative w-64 h-32 flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
      <GlowEffect {...args} />
      <div className="relative z-10 text-emerald-400 font-mono text-sm tracking-widest">
        SYSTEM BREATHING
      </div>
    </div>
  ),
  args: {
    colors: ["#10b981", "#059669"],
    mode: "pulse",
    blur: "medium",
    duration: 3,
  },
};

export const Flow: Story = {
  render: (args) => (
    <div className="relative w-80 h-12 flex items-center justify-center bg-black rounded-full overflow-hidden">
      <GlowEffect {...args} />
      <div className="relative z-10 text-white/50 text-xs tracking-[0.5em] font-medium">
        PROCESSING...
      </div>
    </div>
  ),
  args: {
    colors: ["#ff3b30", "#ff9500", "#ffcc00"],
    mode: "flowHorizontal",
    blur: "soft",
    duration: 2,
  },
};
