import type { Meta, StoryObj } from "@storybook/react";
import { DozerRollForm } from "./DozerRollForm";

const mockDozers = [
  {
    id: "d001-uuid",
    name: "CAT D11 #01",
    serial_number: "CAT-D11-9012",
    site_id: "site-01",
    sites: [{ name: "North Pit" }],
  },
  {
    id: "d002-uuid",
    name: "Komatsu D375 #02",
    serial_number: "KOM-375-4410",
    site_id: "site-01",
    sites: [{ name: "North Pit" }],
  },
  {
    id: "d003-uuid",
    name: "CAT D10T #05",
    serial_number: "CAT-D10T-8819",
    site_id: "site-02",
    sites: [{ name: "South Ramp" }],
  },
];

const meta: Meta<typeof DozerRollForm> = {
  title: "Control Room / DozerRollForm",
  component: DozerRollForm,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    departmentId: { control: "text" },
    today: { control: "text" },
  },
};

export default meta;

type Story = StoryObj<typeof DozerRollForm>;

export const Default: Story = {
  args: {
    departmentId: "dept-control-room-uuid",
    dozers: mockDozers,
    today: "2026-08-18",
  },
};

export const EmptyDozers: Story = {
  args: {
    departmentId: "dept-control-room-uuid",
    dozers: [],
    today: "2026-08-18",
  },
};
