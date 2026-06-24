import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Button } from "./button";
import React from "react";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>System Diagnostics</CardTitle>
        <CardDescription>Review current hardware performance.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Core Temperature</span>
            <span className="text-sm text-accent-green">42°C</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Uptime</span>
            <span className="text-sm">14d 6h 22m</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Refresh</Button>
        <Button>Details</Button>
      </CardFooter>
    </Card>
  ),
};

export const Minimal: Story = {
  render: () => (
    <Card className="w-[200px] p-4 text-center">
      <p className="text-sm font-medium">Network Signal</p>
      <p className="text-2xl font-bold text-accent-blue">98%</p>
    </Card>
  ),
};
