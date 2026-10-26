import {
  Activity,
  Bot,
  Calculator,
  CalendarDays,
  CheckSquare,
  Database,
  Factory,
  FileText,
  Pickaxe,
  ScanFace,
  StickyNote,
  TowerControl,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import type * as React from 'react';
import { getServiceUrls } from '../lib/urls';

export const WHATSAPP_WEB_DIRECT_URL = 'https://web.whatsapp.com/';

export interface MacMenuBarProps {
  menuItems?: readonly string[];
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

export const NAVIGATION_ITEMS: readonly string[] = [];

export const DEPARTMENTS_LIST = [
  {
    name: 'drilling',
    displayName: 'Drilling Operations',
    icon: Pickaxe,
    iconColor: 'text-dept-drilling',
    bgColor: 'bg-dept-drilling/10 hover:bg-dept-drilling/15',
    description: 'Rig operations & depth telemetry',
  },
  {
    name: 'production',
    displayName: 'Production Tracking',
    icon: TrendingUp,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'Yield & tonnage monitoring',
  },
  {
    name: 'plant-processing',
    displayName: 'Plant & Processing',
    icon: Factory,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'Wash plant throughput & recovery',
  },
  {
    name: 'plant-inventory',
    displayName: 'Plant Inventory',
    icon: Database,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'ROM stockpiles, magnetite & reagents',
  },
  {
    name: 'access-control',
    displayName: 'Access Control',
    icon: ScanFace,
    iconColor: 'text-dept-access-control',
    bgColor: 'bg-dept-access-control/10 hover:bg-dept-access-control/15',
    description: 'Personnel badging & visitor logs',
  },
  {
    name: 'engineering',
    displayName: 'Engineering',
    icon: Wrench,
    iconColor: 'text-dept-engineering',
    bgColor: 'bg-dept-engineering/10 hover:bg-dept-engineering/15',
    description: 'CAD, equipment specs & breakdowns',
  },
  {
    name: 'control-room',
    displayName: 'SCADA Control Room',
    icon: TowerControl,
    iconColor: 'text-dept-control-room',
    bgColor: 'bg-dept-control-room/10 hover:bg-dept-control-room/15',
    description: 'Real-time operations monitor',
  },
  {
    name: 'overview',
    displayName: 'System Overview',
    icon: Activity,
    iconColor: 'text-dept-access-control',
    bgColor: 'bg-dept-access-control/10 hover:bg-dept-access-control/15',
    description: 'Architecture, tech stack & telemetry',
  },
  {
    name: 'database',
    displayName: 'Database',
    icon: Database,
    iconColor: 'text-dept-production',
    bgColor: 'bg-dept-production/10 hover:bg-dept-production/15',
    description: 'Supabase PostgreSQL, RLS & schemas',
  },
] as const;

export const PRODUCTIVITY_LIST = [
  {
    name: 'tasks',
    displayName: 'Tasks',
    icon: CheckSquare,
    colorClass: 'text-dept-production',
  },
  {
    name: 'documents',
    displayName: 'Documents',
    icon: FileText,
    colorClass: 'text-dept-drilling',
  },
  {
    name: 'schedule',
    displayName: 'Schedule',
    icon: CalendarDays,
    colorClass: 'text-dept-control-room',
  },
  {
    name: 'calculations',
    displayName: 'Calculations',
    icon: Calculator,
    colorClass: 'text-dept-engineering',
  },
  {
    name: 'notes',
    displayName: 'Notes',
    icon: StickyNote,
    colorClass: 'text-accent-amber',
  },
] as const;

const urls = getServiceUrls();
export const EXTERNAL_LIST = [
  {
    name: 'flowise',
    displayName: 'Flowise AI',
    icon: Bot,
    url: urls.portal,
    colorClass: 'text-[#3ecf8e]',
  },
] as const;

export const NAV_BTN =
  'px-2.5 min-h-11 flex items-center rounded-button text-[13px] font-medium text-[var(--text-heading)] hover:bg-black/10 data-[state=open]:bg-black/10 transition-colors select-none outline-none cursor-default';

export const DROPDOWN_CONTENT =
  'liquid-glass-light backdrop-blur-2xl shadow-window border border-white/20 rounded-card py-1';
