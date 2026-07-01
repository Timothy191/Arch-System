import type { Meta, StoryObj } from "@storybook/react";
import { TelemetryChart } from "./telemetry-chart";
import React, { useState, useEffect } from "react";

const meta: Meta<typeof TelemetryChart> = {
  title: "Industrial/TelemetryChart",
  component: TelemetryChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof TelemetryChart>;

const generateData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    timestamp: i,
    value: Math.floor(Math.random() * 100),
  }));
};

export const Default: Story = {
  args: {
    data: generateData(),
    title: "Engine Temperature",
    unit: "°C",
    color: "#ff3b30",
    className: "w-[500px]",
  },
};

export const LiveDemo: Story = {
  render: (args) => {
    const [data, setData] = useState(generateData());

    useEffect(() => {
      const interval = setInterval(() => {
        setData((prev) => {
          const nextValue = Math.max(
            0,
            Math.min(100, (prev[prev.length - 1]?.value || 50) + (Math.random() * 20 - 10)),
          );
          return [...prev.slice(1), { timestamp: Date.now(), value: nextValue }];
        });
      }, 1000);
      return () => clearInterval(interval);
    }, []);

    return <TelemetryChart {...args} data={data} />;
  },
  args: {
    title: "Hydraulic Pressure",
    unit: "bar",
    color: "#007aff",
    className: "w-[600px]",
  },
};
