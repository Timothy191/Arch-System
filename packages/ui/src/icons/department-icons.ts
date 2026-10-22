import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownUp,
  BarChart2,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  CreditCard,
  Database,
  Download,
  Drill,
  Eye,
  Factory,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  HardHat,
  HelpCircle,
  History,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  MoreVertical,
  Orbit,
  Package,
  Pencil,
  Pickaxe,
  Play,
  Plus,
  Power,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  ScanFace,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Slash,
  Sliders,
  Square,
  TowerControl,
  TrendingUp,
  Truck,
  Upload,
  User,
  Users,
  Wifi,
  WifiOff,
  Wrench,
  XCircle,
} from 'lucide-react';

/**
 * Single Source of Truth (SSoT) Department Lucide Icon Registry.
 * Maps every operational department to its canonical, standardized Lucide icon.
 */
export const DEPARTMENT_ICON_REGISTRY: Record<string, LucideIcon> = {
  admin: Wrench,
  'access-control': ShieldCheck,
  production: Factory,
  drilling: Drill,
  'plant-processing': Factory,
  'plant-inventory': Package,
  engineering: Wrench,
  'control-room': TowerControl,
  fleet: Truck,
  database: Database,
  finance: CreditCard,
  safety: HardHat,
  hr: GraduationCap,
  analytics: Orbit,
  exploration: Compass,
  energy: Orbit,
};

/**
 * Standard Operational Actions & Status Icon Registry.
 * Guarantees visual consistency across action buttons, toolbars, and status badges.
 */
export const ACTION_ICON_REGISTRY = {
  search: Search,
  add: Plus,
  edit: Pencil,
  view: Eye,
  export: Download,
  import: Upload,
  history: History,
  settings: Settings,
  notifications: Bell,
  filter: Filter,
  sort: ArrowDownUp,
  refresh: RefreshCw,
  print: Printer,
  user: User,
  users: Users,
  logout: LogOut,
  moreHorizontal: MoreHorizontal,
  moreVertical: MoreVertical,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  maximize: Maximize2,
  minimize: Minimize2,
} as const;

/**
 * Standard Status & Feedback Icon Registry.
 */
export const STATUS_ICON_REGISTRY = {
  success: CheckCircle2,
  confirmed: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  critical: AlertOctagon,
  info: HelpCircle,
  online: Wifi,
  offline: WifiOff,
  active: Play,
  standby: Clock,
  stopped: Square,
  maintenance: Wrench,
  reset: RotateCcw,
  power: Power,
  shield: Shield,
  lock: Lock,
} as const;

/**
 * Get canonical department icon with fallback to Layers icon.
 */
export function getDepartmentIcon(deptName: string): LucideIcon {
  const normalized = deptName.toLowerCase().trim();
  return DEPARTMENT_ICON_REGISTRY[normalized] ?? Layers;
}

/**
 * Get canonical action icon.
 */
export function getActionIcon(action: keyof typeof ACTION_ICON_REGISTRY): LucideIcon {
  return ACTION_ICON_REGISTRY[action];
}

/**
 * Get canonical status icon.
 */
export function getStatusIcon(status: keyof typeof STATUS_ICON_REGISTRY): LucideIcon {
  return STATUS_ICON_REGISTRY[status];
}
