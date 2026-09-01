import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    label: "Accept terms and conditions",
  },
};

export const Checked: Story = {
  args: {
    label: "Enable notifications",
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled option",
    disabled: true,
  },
};

export const WithoutLabel: Story = {
  args: {},
};
