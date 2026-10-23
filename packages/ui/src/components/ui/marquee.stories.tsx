import type { Meta, StoryObj } from '@storybook/react';
import { Marquee } from './marquee';

const meta: Meta<typeof Marquee> = {
  title: 'UI/Marquee',
  component: Marquee,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof Marquee>;

const Logo = () => (
  <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/5 px-8 py-4 backdrop-blur-sm">
    <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-blue/20">
      <div className="h-4 w-4 animate-pulse rounded-sm bg-accent-blue" />
    </div>
    <span className="font-bold font-mono text-sm tracking-tighter">ARCH_OS</span>
  </div>
);

export const Horizontal: Story = {
  args: {
    children: (
      <>
        <Logo />
        <Logo />
        <Logo />
        <Logo />
        <Logo />
      </>
    ),
    pauseOnHover: true,
  },
};

export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-[400px] items-center justify-center bg-slate-50">
      <Marquee {...args} className="h-full" />
    </div>
  ),
  args: {
    vertical: true,
    children: (
      <>
        <Logo />
        <Logo />
        <Logo />
        <Logo />
      </>
    ),
  },
};

export const FastReverse: Story = {
  args: {
    reverse: true,
    children: (
      <div className="flex gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="font-black text-4xl text-black/10 uppercase italic">
            Telemetry Processing —
          </span>
        ))}
      </div>
    ),
    className: '[--duration:10s]',
  },
};
