import type { Meta, StoryObj } from "@storybook/react";
import { SecondaryButton } from "./SecondaryButton";

const meta: Meta<typeof SecondaryButton> = {
  title: "Components/SecondaryButton",
  component: SecondaryButton,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "default"],
    },
    variant: {
      control: "select",
      options: ["default", "rounded-lg"],
    },
    disabled: {
      control: "boolean",
    },
  },
};

export default meta;

type Story = StoryObj<typeof SecondaryButton>;

export const Default: Story = {
  args: {
    children: "Action Button",
    size: "default",
    variant: "default",
  },
};

export const Small: Story = {
  args: {
    children: "Small Action",
    size: "sm",
  },
};

export const RoundedLg: Story = {
  args: {
    children: "Square-ish Button",
    variant: "rounded-lg",
  },
};

export const Disabled: Story = {
  args: {
    children: "Disabled State",
    disabled: true,
  },
};
