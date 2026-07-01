import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    type: "text",
    placeholder: "Search system logs...",
  },
};

export const Email: Story = {
  args: {
    type: "email",
    placeholder: "operator@arch.os",
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Enter access code",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "Read-only input",
  },
};
