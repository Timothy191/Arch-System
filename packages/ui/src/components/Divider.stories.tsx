import type { Meta, StoryObj } from "@storybook/react";
import { Divider } from "./Divider";

const meta: Meta<typeof Divider> = {
  title: "Components/Borders/Divider",
  component: Divider,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "dotted", "fading", "double", "dashed"],
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
    },
    label: {
      control: "text",
    },
  },
};

export default meta;

type Story = StoryObj<typeof Divider>;

export const DefaultHorizontal: Story = {
  args: {
    variant: "default",
    orientation: "horizontal",
  },
};

export const DottedDivider: Story = {
  args: {
    variant: "dotted",
    orientation: "horizontal",
  },
};

export const DottedDividerWithLabel: Story = {
  args: {
    variant: "dotted",
    label: "Telemetry Channel 01",
  },
};

export const FadingDivider: Story = {
  args: {
    variant: "fading",
    orientation: "horizontal",
  },
};

export const FadingDividerWithLabel: Story = {
  args: {
    variant: "fading",
    label: "Section Break",
  },
};

export const DoubleDivider: Story = {
  args: {
    variant: "double",
    orientation: "horizontal",
  },
};
