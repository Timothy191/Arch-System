import type { Meta, StoryObj } from '@storybook/react';
import { Spotlight } from './spotlight';

const meta: Meta<typeof Spotlight> = {
  title: 'Motion/Spotlight',
  component: Spotlight,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Spotlight>;

export const Default: Story = {
  render: (args) => (
    <div className="relative flex h-[400px] w-[600px] flex-col items-center justify-center overflow-hidden rounded-3xl border bg-slate-950">
      <Spotlight {...args} />
      <h1 className="select-none font-black text-6xl text-white/10 tracking-tighter">SPOTLIGHT</h1>
      <p className="mt-4 select-none text-white/20">Hover to reveal the hidden architecture</p>
    </div>
  ),
  args: {
    size: 300,
  },
};

export const Cyan: Story = {
  render: (args) => (
    <div className="relative flex h-[300px] w-[300px] items-center justify-center overflow-hidden rounded-xl border bg-black">
      <Spotlight {...args} className="from-accent-blue via-accent-blue/50 to-transparent" />
      <div className="h-16 w-16 rounded border border-white/10 bg-white/5" />
    </div>
  ),
  args: {
    size: 150,
  },
};
