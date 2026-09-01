import type { Meta, StoryObj } from "@storybook/react";
import { Inbox, Search, AlertCircle } from "lucide-react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No items found",
    description: "There are no items to display at this time.",
  },
};

export const WithIcon: Story = {
  args: {
    icon: Inbox,
    title: "Inbox is empty",
    description: "You have no new messages. Check back later.",
  },
};

export const WithAction: Story = {
  args: {
    icon: Search,
    title: "No results",
    description: "Try adjusting your search criteria.",
    action: <button className="text-sm text-blue-500 hover:underline">Clear filters</button>,
  },
};

export const Error: Story = {
  args: {
    icon: AlertCircle,
    title: "Something went wrong",
    description: "We couldn't load the data. Please try again.",
    action: <button className="text-sm text-blue-500 hover:underline">Retry</button>,
  },
};
