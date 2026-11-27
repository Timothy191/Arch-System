import type { Meta, StoryObj } from '@storybook/react';
import { ArchSeparator } from './Separator';

const meta: Meta<typeof ArchSeparator> = {
  title: 'Components/Borders/ArchSeparator',
  component: ArchSeparator,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['hairline', 'gold', 'gold-emblem', 'pipe'],
    },
    orientation: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
    },
    glow: { control: 'boolean' },
    decorative: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof ArchSeparator>;

export const Hairline: Story = {
  args: { variant: 'hairline' },
};

export const Golden: Story = {
  args: { variant: 'gold' },
};

export const GoldenEmblem: Story = {
  args: { variant: 'gold-emblem', glow: true },
};

export const Pipe: Story = {
  args: { variant: 'pipe' },
};
