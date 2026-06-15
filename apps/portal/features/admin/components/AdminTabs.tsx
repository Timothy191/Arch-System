"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import {
  Users,
  Building2,
  Webhook,
  FileText,
  Settings,
  Truck,
  MapPin,
} from "lucide-react";

const TABS = [
  { value: "users", label: "Users", icon: Users },
  { value: "departments", label: "Departments", icon: Building2 },
  { value: "fleet", label: "Fleet", icon: Truck },
  { value: "sites", label: "Sites", icon: MapPin },
  { value: "webhooks", label: "Webhooks", icon: Webhook },
  { value: "audit-logs", label: "Audit Logs", icon: FileText },
  { value: "settings", label: "Settings", icon: Settings },
];

interface AdminTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange: (_value: string) => void;
  children: React.ReactNode;
}

export function AdminTabs({
  defaultValue,
  value,
  onValueChange,
  children,
}: AdminTabsProps) {
  return (
    <Tabs
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className="w-full"
    >
      <TabsList className="w-full justify-start bg-[var(--bg-secondary)] border border-[var(--border-default)]">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="data-[state=active]:bg-[var(--bg-primary)] data-[state=active]:text-[var(--text-heading)]"
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
