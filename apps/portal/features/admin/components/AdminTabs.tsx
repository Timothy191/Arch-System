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
  const activeTab = TABS.find((t) => t.value === (value ?? defaultValue ?? 'users')) ?? TABS[0];
  const ActiveIcon = ADMIN_SUBTAB_ICONS[activeTab.value] ?? AdminSettingsIcon;

  return (
    <Tabs
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className="w-full space-y-6"
    >
      {/* Active section header on desktop (navigation lives in the sidebar under General) */}
      <div className="gold-steel-border gold-steel-border-slim hidden items-center justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-white/80 px-5 py-3.5 shadow-2xs backdrop-blur-md md:flex">
        <div className="flex items-center gap-3">
          <div className="gold-steel-border gold-steel-border-slim flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
            <ActiveIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-heading)] text-sm">{activeTab.label}</h2>
            <p className="text-[var(--text-secondary)] text-xs">{activeTab.description}</p>
          </div>
        </div>
        <span className="rounded-full border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-mono font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
          Console · {activeTab.value}
        </span>
      </div>

      {/* Mobile fallback tab strip */}
      <TabsList className="w-full justify-start overflow-x-auto border border-[var(--border-default)] bg-[var(--bg-secondary)] md:hidden">
        {TABS.map((tab) => {
          const Icon = ADMIN_SUBTAB_ICONS[tab.value] ?? AdminSettingsIcon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
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
