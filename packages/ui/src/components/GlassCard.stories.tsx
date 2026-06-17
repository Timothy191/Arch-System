import type { Meta, StoryObj } from "@storybook/react";
import { GlassCard } from "./GlassCard";
import React from "react";

const meta: Meta<typeof GlassCard> = {
  title: "Components/GlassCard",
  component: GlassCard,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    accent: {
      control: "select",
      options: [
        "green",
        "blue",
        "red",
        "cyan",
        "indigo",
        "violet",
        "alert",
        "none",
      ],
    },
    variant: {
      control: "select",
      options: ["default", "window", "spotlight", "glowborder", "liquid"],
    },
    colorPreset: {
      control: "select",
      options: ["nature", "ocean", "sunset", "aurora", "custom"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof GlassCard>;

export const Default: Story = {
  args: {
    children: (
      <div className="w-64 h-32 flex items-center justify-center">
        <p className="text-[var(--text-heading)] font-medium">
          Standard Glass Card
        </p>
      </div>
    ),
    variant: "default",
    hover: true,
  },
};

export const Window: Story = {
  args: {
    title: "Terminal",
    children: (
      <div className="w-80 h-48 bg-black/90 p-4 font-mono text-green-400 text-sm">
        <p>arch-system login: admin</p>
        <p>password: ********</p>
        <p className="mt-2">Welcome to Arch-System CLI v1.5.1</p>
        <p className="animate-pulse">_</p>
      </div>
    ),
    variant: "window",
    padding: false,
  },
};

export const Spotlight: Story = {
  args: {
    children: (
      <div className="w-64 h-32 flex items-center justify-center">
        <p className="text-[var(--text-heading)] font-medium text-center">
          Hover me to see the <br /> spotlight effect
        </p>
      </div>
    ),
    variant: "spotlight",
    spotlightColor: "rgba(28, 28, 30, 0.15)",
  },
};

export const GlowBorder: Story = {
  args: {
    children: (
      <div className="w-64 h-32 flex items-center justify-center">
        <p className="text-[var(--text-heading)] font-medium">
          Glow Border variant
        </p>
      </div>
    ),
    variant: "glowborder",
    colorPreset: "aurora",
  },
};

export const Liquid: Story = {
  args: {
    children: (
      <div className="w-64 h-32 flex items-center justify-center">
        <p className="text-[var(--text-heading)] font-medium">
          Liquid Glass Refraction
        </p>
      </div>
    ),
    variant: "liquid",
    hover: true,
  },
};
