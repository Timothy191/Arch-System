import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import React from "react";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
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
        <div className="p-4 border rounded-md bg-white/50">
          <p className="text-sm font-medium">Account Details</p>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your system credentials.
          </p>
        </div>
      </TabsContent>
      <TabsContent value="password">
        <div className="p-4 border rounded-md bg-white/50">
          <p className="text-sm font-medium">Security Policy</p>
          <p className="text-xs text-muted-foreground mt-1">
            Update your access codes.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
