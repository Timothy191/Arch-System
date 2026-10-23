import type { Meta, StoryObj } from '@storybook/react';
import { GlowEffect } from './glow-effect';

const meta: Meta<typeof GlowEffect> = {
  title: 'Motion/GlowEffect',
  component: GlowEffect,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    mode: {
      control: 'select',
      options: ['rotate', 'pulse', 'breathe', 'colorShift', 'flowHorizontal', 'static'],
    },
    blur: {
      control: 'select',
      options: ['softest', 'soft', 'medium', 'strong', 'stronger', 'strongest', 'none'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof GlowEffect>;

export const Default: Story = {
  render: (args) => (
    <div className="relative flex h-64 w-64 items-center justify-center overflow-hidden rounded-3xl bg-black shadow-window">
      <GlowEffect {...args} />
      <div className="relative z-10 font-bold text-white text-xl">ARCH CORE</div>
    </div>
  ),
  args: {
    colors: ['#00d4aa', '#007aff', '#5856d6', '#00d4aa'],
    mode: 'rotate',
    blur: 'strong',
    duration: 5,
  },
};

export const Pulse: Story = {
  render: (args) => (
    <div className="relative flex h-32 w-64 items-center justify-center overflow-hidden rounded-xl bg-slate-900">
      <GlowEffect {...args} />
      <div className="relative z-10 font-mono text-emerald-400 text-sm tracking-widest">
        SYSTEM BREATHING
      </div>
    </div>
  ),
  args: {
    colors: ['#10b981', '#059669'],
    mode: 'pulse',
    blur: 'medium',
    duration: 3,
  },
};

export const Flow: Story = {
  render: (args) => (
    <div className="relative flex h-12 w-80 items-center justify-center overflow-hidden rounded-full bg-black">
      <GlowEffect {...args} />
      <div className="relative z-10 font-medium text-white/50 text-xs tracking-[0.5em]">
        PROCESSING...
      </div>
    </div>
  ),
  args: {
    colors: ['#ff3b30', '#ff9500', '#ffcc00'],
    mode: 'flowHorizontal',
    blur: 'soft',
    duration: 2,
  },
};
