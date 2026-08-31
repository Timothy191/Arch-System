import type { Meta, StoryObj } from "@storybook/react";
import { Clock } from "./Clock";

const meta: Meta<typeof Clock> = {
  title: "Components/Display/Clock",
  component: Clock,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    format: {
      control: "select",
      options: ["time", "date", "datetime"],
    },
    locale: { control: "text" },
    hour12: { control: "boolean" },
    showSeconds: { control: "boolean" },
  },
  render: (args) => (
    <div className="rounded-lg border border-black/10 bg-[var(--color-bg-base)] px-4 py-2">
      <Clock {...args} />
    </div>
  ),
};

export default meta;

type Story = StoryObj<typeof Clock>;

export const Time12h: Story = {
  args: {
    format: "time",
    locale: "en-US",
    hour12: true,
  },
};

export const Time24h: Story = {
  args: {
    format: "time",
    locale: "en-GB",
    hour12: false,
  },
};

export const TimeWithSeconds: Story = {
  args: {
    format: "time",
    showSeconds: true,
  },
};

export const DateOnly: Story = {
  args: {
    format: "date",
  },
};

export const DateTime: Story = {
  args: {
    format: "datetime",
  },
};
