import type { Meta, StoryObj } from "@storybook/react";
import { MacMenuBar } from "./MacMenuBar";
import React from "react";
import { Bell, Wifi, Battery } from "lucide-react";

const meta: Meta<typeof MacMenuBar> = {
  title: "Components/MacMenuBar",
  component: MacMenuBar,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof MacMenuBar>;

export const Default: Story = {
  args: {
    menuItems: ["Operations", "Tools", "View", "Help"],
    rightSlot: (
      <div className="flex items-center gap-3 pr-2">
        <Wifi className="w-3.5 h-3.5" />
        <Battery className="w-3.5 h-3.5" />
        <div className="flex items-center gap-1.5 ml-1">
          <Bell className="w-3.5 h-3.5" />
          <span className="font-medium">10:45 AM</span>
        </div>
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="h-24 bg-slate-100 p-4">
        <Story />
      </div>
    ),
  ],
};

export const Minimal: Story = {
  args: {
    menuItems: ["File", "Edit"],
  },
  decorators: [
    (Story) => (
      <div className="h-24 bg-slate-100 p-4">
        <Story />
      </div>
    ),
  ],
};
