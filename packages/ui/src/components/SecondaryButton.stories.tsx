import type { Meta, StoryObj } from "@storybook/react";
import { SecondaryButton } from "./SecondaryButton";

const meta: Meta<typeof SecondaryButton> = {
  title: "Components/SecondaryButton",
  component: SecondaryButton,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "default"],
    },
    variant: {
      control: "select",
      options: ["default", "rounded-lg"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof SecondaryButton>;

export const Default: Story = {
  args: {
    children: "Secondary Button",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "Small Button",
  },
};

export const RoundedCorners: Story = {
  args: {
    variant: "rounded-lg",
    children: "Rounded Button",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled Button",
  },
};
