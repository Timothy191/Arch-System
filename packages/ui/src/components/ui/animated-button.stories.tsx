import type { Meta, StoryObj } from "@storybook/react";
import { AnimatedButton } from "./animated-button";

const meta: Meta<typeof AnimatedButton> = {
  title: "UI/AnimatedButton",
  component: AnimatedButton,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "accent", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    hoverScale: {
      control: { type: "range", min: 0.8, max: 1.2, step: 0.01 },
    },
    tapScale: {
      control: { type: "range", min: 0.8, max: 1.2, step: 0.01 },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AnimatedButton>;

export const Default: Story = {
  args: {
    children: "Deploy System",
    variant: "default",
  },
};

export const Accent: Story = {
  args: {
    children: "Launch Operations",
    variant: "accent",
  },
};

export const Destructive: Story = {
  args: {
    children: "Terminate Process",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "View Details",
    variant: "outline",
  },
};
