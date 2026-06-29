import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
};

export const Secondary: Story = {
  args: {
    children: "Secondary Action",
    variant: "secondary",
  },
};

export const Destructive: Story = {
  args: {
    children: "Delete Record",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "System Settings",
    variant: "outline",
  },
};

export const Ghost: Story = {
  args: {
    children: "Cancel",
    variant: "ghost",
  },
};

export const Icon: Story = {
  args: {
    children: "🔔",
    variant: "outline",
    size: "icon",
  },
};
