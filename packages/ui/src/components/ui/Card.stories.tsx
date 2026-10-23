import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
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
            <span className="font-medium text-sm">Core Temperature</span>
            <span className="text-accent-green text-sm">42°C</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Uptime</span>
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
      <p className="font-medium text-sm">Network Signal</p>
      <p className="font-bold text-2xl text-accent-blue">98%</p>
    </Card>
  ),
};
