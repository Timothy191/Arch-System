import type { Meta, StoryObj } from "@storybook/react";
import { BorderBox } from "./BorderBox";

const meta: Meta<typeof BorderBox> = {
  title: "Components/Borders/BorderBox",
  component: BorderBox,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "solid",
        "dotted",
        "double",
        "gradient",
        "bevelled",
        "bevelled-inset",
        "handdrawn",
        "patterned",
        "patterned-caution",
        "thick-transparent",
        "fading",
      ],
    },
    padding: {
      control: "select",
      options: ["none", "sm", "md", "lg", "xl"],
    },
    rounded: {
      control: "select",
      options: ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof BorderBox>;

export const DottedBorder: Story = {
  args: {
    variant: "dotted",
    padding: "lg",
    children: "1. Dotted Border Technique — Precision industrial dotted bounding frame.",
  },
};

export const DoubleBorder: Story = {
  args: {
    variant: "double",
    padding: "lg",
    children: "2. Double Border Technique — Dual-line high-contrast boundary.",
  },
};

export const GradientBorder: Story = {
  args: {
    variant: "gradient",
    padding: "lg",
    children: "3. Gradient Border Technique — Smooth OKLCH transition border.",
  },
};

export const BevelledBorder: Story = {
  args: {
    variant: "bevelled",
    padding: "lg",
    children: "4. Bevelled Border Technique — Industrial chamfered inset/outset lighting.",
  },
};

export const HandDrawnBorder: Story = {
  args: {
    variant: "handdrawn",
    padding: "lg",
    children: "5. Hand-Drawn Border Technique — Organic sketched irregular radius outline.",
  },
};

export const PatternedBorder: Story = {
  args: {
    variant: "patterned-caution",
    padding: "lg",
    children: "6. Patterned Border Technique — Repeating diagonal caution hatch frame.",
  },
};

export const ThickTransparentBorder: Story = {
  args: {
    variant: "thick-transparent",
    padding: "lg",
    children: "7. Thick Transparent Border Technique — Liquid glass 4px translucent border.",
  },
};

export const FadingBorder: Story = {
  args: {
    variant: "fading",
    padding: "lg",
    children: "8. Fading Border Technique — Radial edge fade border overlay.",
  },
};
