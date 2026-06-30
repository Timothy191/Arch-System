import type { Meta, StoryObj } from "@storybook/react";
import { BorderTrail } from "./border-trail";
import React from "react";

const meta: Meta<typeof BorderTrail> = {
  title: "Motion/BorderTrail",
  component: BorderTrail,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof BorderTrail>;

export const Default: Story = {
  render: (args) => (
    <div className="relative h-[200px] w-[300px] rounded-xl border border-black/10 bg-white flex items-center justify-center">
      <p className="text-slate-400 font-medium">Border Trail Effect</p>
      <BorderTrail {...args} className="bg-gradient-to-r from-blue-400 to-indigo-500" />
    </div>
  ),
  args: {
    size: 60,
  },
};

export const FastAlert: Story = {
  render: (args) => (
    <div className="relative h-[100px] w-[400px] rounded-lg border border-red-100 bg-red-50/30 flex items-center justify-center">
      <p className="text-red-600 font-bold animate-pulse">CRITICAL SYSTEM ALERT</p>
      <BorderTrail {...args} className="bg-red-500" />
    </div>
  ),
  args: {
    size: 100,
    transition: {
      repeat: Infinity,
      duration: 2,
      ease: "linear",
    },
  },
};
