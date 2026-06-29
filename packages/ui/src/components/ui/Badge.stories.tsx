import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Active",
    variant: "default",
  },
};

export const Secondary: Story = {
  args: {
    children: "Maintenance",
    variant: "secondary",
  },
};

export const Destructive: Story = {
  args: {
    children: "Critical",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "Draft",
    variant: "outline",
  },
};
