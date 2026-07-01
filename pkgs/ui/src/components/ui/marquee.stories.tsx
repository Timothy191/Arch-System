import type { Meta, StoryObj } from "@storybook/react";
import { Marquee } from "./marquee";
import React from "react";

const meta: Meta<typeof Marquee> = {
  title: "UI/Marquee",
  component: Marquee,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Marquee>;

const Logo = () => (
  <div className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-black/10 rounded-xl backdrop-blur-sm">
    <div className="w-8 h-8 rounded bg-accent-blue/20 flex items-center justify-center">
      <div className="w-4 h-4 bg-accent-blue rounded-sm animate-pulse" />
    </div>
    <span className="font-mono text-sm font-bold tracking-tighter">ARCH_OS</span>
  </div>
);

export const Horizontal: Story = {
  args: {
    children: (
      <>
        <Logo />
        <Logo />
        <Logo />
        <Logo />
        <Logo />
      </>
    ),
    pauseOnHover: true,
  },
};

export const Vertical: Story = {
  render: (args) => (
    <div className="h-[400px] flex items-center justify-center bg-slate-50">
      <Marquee {...args} className="h-full" />
    </div>
  ),
  args: {
    vertical: true,
    children: (
      <>
        <Logo />
        <Logo />
        <Logo />
        <Logo />
      </>
    ),
  },
};

export const FastReverse: Story = {
  args: {
    reverse: true,
    children: (
      <div className="flex gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="text-4xl font-black text-black/10 uppercase italic">
            Telemetry Processing —
          </span>
        ))}
      </div>
    ),
    className: "[--duration:10s]",
  },
};
