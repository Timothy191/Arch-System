import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <div className="rounded-md border bg-white/50 p-4">
          <p className="font-medium text-sm">Account Details</p>
          <p className="mt-1 text-muted-foreground text-xs">Manage your system credentials.</p>
        </div>
      </TabsContent>
      <TabsContent value="password">
        <div className="rounded-md border bg-white/50 p-4">
          <p className="font-medium text-sm">Security Policy</p>
          <p className="mt-1 text-muted-foreground text-xs">Update your access codes.</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
