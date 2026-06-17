import type { Meta, StoryObj } from "@storybook/react";
import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Components/PageHeader",
  component: PageHeader,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: "Drilling Operations Overview",
    showDate: true,
  },
};

export const WithoutDate: Story = {
  args: {
    title: "System Settings",
    showDate: false,
  },
};
