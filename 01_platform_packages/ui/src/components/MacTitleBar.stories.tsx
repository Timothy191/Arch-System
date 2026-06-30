import type { Meta, StoryObj } from "@storybook/react";
import { MacTitleBar } from "./MacTitleBar";
import React from "react";
import { Search, MoreHorizontal } from "lucide-react";

const meta: Meta<typeof MacTitleBar> = {
  title: "Components/MacTitleBar",
  component: MacTitleBar,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof MacTitleBar>;

export const Default: Story = {
  args: {
    title: "System Status",
  },
};

export const WithControls: Story = {
  args: {
    title: "Finder",
    onClose: () => alert("Close clicked"),
    onMinimize: () => alert("Minimize clicked"),
    onMaximize: () => alert("Maximize clicked"),
  },
};

export const WithRightSlot: Story = {
  args: {
    title: "Operations Log",
    rightSlot: (
      <>
        <button type="button" className="p-1 hover:bg-black/5 rounded">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        </button>
        <button type="button" className="p-1 hover:bg-black/5 rounded">
          <MoreHorizontal className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        </button>
      </>
    ),
  },
};
