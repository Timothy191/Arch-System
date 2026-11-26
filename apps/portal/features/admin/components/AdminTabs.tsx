'use client';

import { ADMIN_SUBTAB_ICONS, AdminSettingsIcon } from '@repo/ui/admin-icons';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';

const TABS = [
  { value: 'users', label: 'Users', description: 'Operator accounts, roles & department access' },
  {
    value: 'departments',
    label: 'Departments',
    description: 'Operational divisions & cost centers',
  },
  { value: 'fleet', label: 'Fleet', description: 'Haulage trucks, drill rigs & plant assets' },
  {
    value: 'sites',
    label: 'Sites & Blocks',
    description: 'Mining pits, benches & extraction blocks',
  },
  { value: 'minerals', label: 'Minerals', description: 'Commodity grades & ore specifications' },
  { value: 'targets', label: 'Targets', description: 'Shift tonnage, meters & yield benchmarks' },
  {
    value: 'integrations',
    label: 'Integrations',
    description: 'SCADA, ERP & third-party connectors',
  },
  { value: 'webhooks', label: 'Webhooks', description: 'n8n triggers & signed event endpoints' },
  { value: 'audit-logs', label: 'Audit Logs', description: 'Immutable RBAC & mutation trail' },
  { value: 'system-logs', label: 'System Logs', description: 'Runtime diagnostics & trace events' },
  { value: 'settings', label: 'Settings', description: 'Global portal & shift configuration' },
  {
    value: 'external-content',
    label: 'External Content',
    description: 'Embedded reports & external feeds',
  },
] as const;

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
      {/* Mobile fallback tab strip */}
      <TabsList className="w-full justify-start overflow-x-auto border border-[var(--border-default)] bg-[var(--bg-secondary)] md:hidden">
        {TABS.map((tab) => {
          const Icon = ADMIN_SUBTAB_ICONS[tab.value] ?? AdminSettingsIcon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              title={tab.description}
              className="data-[state=active]:bg-[var(--bg-primary)] data-[state=active]:text-[var(--text-heading)]"
            >
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}
