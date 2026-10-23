import type { Meta, StoryObj } from '@storybook/react';
import { BorderTrail } from './border-trail';

const meta: Meta<typeof BorderTrail> = {
  title: 'Motion/BorderTrail',
  component: BorderTrail,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof BorderTrail>;

export const Default: Story = {
  render: (args) => (
    <div className="relative flex h-[200px] w-[300px] items-center justify-center rounded-xl border border-black/10 bg-white">
      <p className="font-medium text-slate-400">Border Trail Effect</p>
      <BorderTrail {...args} className="bg-gradient-to-r from-blue-400 to-indigo-500" />
    </div>
  ),
  args: {
    size: 60,
  },
};

export const FastAlert: Story = {
  render: (args) => (
    <div className="relative flex h-[100px] w-[400px] items-center justify-center rounded-lg border border-red-100 bg-red-50/30">
      <p className="animate-pulse font-bold text-red-600">CRITICAL SYSTEM ALERT</p>
      <BorderTrail {...args} className="bg-red-500" />
    </div>
  ),
  args: {
    size: 100,
    transition: {
      repeat: Infinity,
      duration: 2,
      ease: 'linear',
    },
  },
};
