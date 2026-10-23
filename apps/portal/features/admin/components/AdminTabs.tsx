'use client';

import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import {
  Building2,
  FileText,
  Layers,
  MapPin,
  Plug,
  Settings,
  Target,
  Truck,
  Users,
  Webhook,
} from 'lucide-react';

const TABS = [
  { value: 'users', label: 'Users', icon: Users },
  { value: 'departments', label: 'Departments', icon: Building2 },
  { value: 'fleet', label: 'Fleet', icon: Truck },
  { value: 'sites', label: 'Sites & Blocks', icon: MapPin },
  { value: 'minerals', label: 'Minerals', icon: Layers },
  { value: 'targets', label: 'Targets', icon: Target },
  { value: 'integrations', label: 'Integrations', icon: Plug },
  { value: 'webhooks', label: 'Webhooks', icon: Webhook },
  { value: 'audit-logs', label: 'Audit Logs', icon: FileText },
  { value: 'settings', label: 'Settings', icon: Settings },
];

interface AdminTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange: (_value: string) => void;
  children: React.ReactNode;
}

export function AdminTabs({ defaultValue, value, onValueChange, children }: AdminTabsProps) {
  return (
    <Tabs
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className="w-full space-y-6"
    >
      <TabsList className="w-full justify-start border border-[var(--border-default)] bg-[var(--bg-secondary)]">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="data-[state=active]:bg-[var(--bg-primary)] data-[state=active]:text-[var(--text-heading)]"
          >
            <tab.icon className="mr-2 h-4 w-4" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
