import type { Meta, StoryObj } from "@storybook/react";
import { AcknowledgeButton } from "./AcknowledgeButton";
import React from "react";

const meta: Meta<typeof AcknowledgeButton> = {
  title: "Industrial/AcknowledgeButton",
  component: AcknowledgeButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof AcknowledgeButton>;

export const Default: Story = {
  args: {
    onAcknowledge: () => alert("Acknowledged!"),
    confirmTitle: "Confirm System Reset",
    confirmDescription:
      "Are you sure you want to acknowledge this critical system alert?",
  },
};
