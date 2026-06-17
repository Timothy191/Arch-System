import type { Meta, StoryObj } from "@storybook/react";
import { CyberButton } from "./cyber-button";
import { Terminal } from "lucide-react";
import React from "react";

const meta: Meta<typeof CyberButton> = {
  title: "UI/CyberButton",
  component: CyberButton,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["cyan", "blue", "alert"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof CyberButton>;

export const Cyan: Story = {
  args: {
    children: (
      <>
        <Terminal className="w-4 h-4" />
        <span>Initialize Core</span>
      </>
    ),
    variant: "cyan",
  },
};

export const Blue: Story = {
  args: {
    children: "Network Scan",
    variant: "blue",
  },
};

export const Alert: Story = {
  args: {
    children: "Emergency Stop",
    variant: "alert",
  },
};

export const Large: Story = {
  args: {
    children: "Override Protocol",
    size: "lg",
    variant: "cyan",
  },
};
