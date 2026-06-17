import type { Meta, StoryObj } from "@storybook/react";
import { KPICard } from "./KPI";

const meta: Meta<typeof KPICard> = {
  title: "Components/KPICard",
  component: KPICard,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    color: {
      control: "select",
      options: ["default", "green", "blue", "red", "cyan", "indigo", "alert"],
    },
    subColor: {
      control: "select",
      options: ["default", "green", "blue", "red", "cyan", "indigo", "alert"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof KPICard>;

export const Default: Story = {
  args: {
    label: "Machine Status",
    value: "Operational",
    color: "default",
  },
};

export const Critical: Story = {
  args: {
    label: "Temperature",
    value: "95°C",
    color: "alert",
    sub: "Action required",
    subColor: "alert",
  },
};

export const Production: Story = {
  args: {
    label: "Hourly Yield",
    value: "1,240 tons",
    color: "green",
    sub: "+12% vs avg",
    subColor: "green",
  },
};
