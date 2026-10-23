import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  ClipboardCheck,
  Cpu,
  CreditCard,
  Database,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Network,
  Pickaxe,
  Printer,
  QrCode,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { DEPARTMENTS } from '../lib/data';

const routeIcons: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="h-4 w-4" />,
  'Daily Log': <FileText className="h-4 w-4" />,
  Machines: <Settings className="h-4 w-4" />,
  History: <History className="h-4 w-4" />,
  Reports: <BarChart3 className="h-4 w-4" />,
  Tools: <Wrench className="h-4 w-4" />,
  Sites: <Building2 className="h-4 w-4" />,
  Fleet: <Truck className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Departments: <Layers className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Integrations: <Server className="h-4 w-4" />,
  'AI Metrics': <Bot className="h-4 w-4" />,
  'Drilling Operations': <Pickaxe className="h-4 w-4" />,
  'Machine Telemetry': <Activity className="h-4 w-4" />,
  'Muster Station': <LifeBuoy className="h-4 w-4" />,
  'Print Cards': <Printer className="h-4 w-4" />,
  'QR Codes': <QrCode className="h-4 w-4" />,
  'Access Logs': <ShieldCheck className="h-4 w-4" />,
  Visitors: <Users className="h-4 w-4" />,
  Badges: <CreditCard className="h-4 w-4" />,
  'Tire Management': <AlertTriangle className="h-4 w-4" />,
  'Shift Operations': <ClipboardCheck className="h-4 w-4" />,
  'Operational Delays': <AlertTriangle className="h-4 w-4" />,
  'Shift Coverage': <Users className="h-4 w-4" />,
  'Roll Over': <RefreshCw className="h-4 w-4" />,
  Breakdowns: <Wrench className="h-4 w-4" />,
  'Engineering Notes': <FileText className="h-4 w-4" />,
  'Machine Operations': <Cpu className="h-4 w-4" />,
  'Hourly Loads': <Truck className="h-4 w-4" />,
  'Excavator Activity': <Cpu className="h-4 w-4" />,
  'System Architecture': <Network className="h-4 w-4" />,
  'Backend Topology': <Server className="h-4 w-4" />,
  'Database Schema': <Database className="h-4 w-4" />,
  'Audit & Compliance': <ShieldCheck className="h-4 w-4" />,
  'Agentic Monitor': <Bot className="h-4 w-4" />,
  Schemas: <Database className="h-4 w-4" />,
  Panels: <Activity className="h-4 w-4" />,
};

export default function DepartmentBreakdown() {
  const totalRoutes = DEPARTMENTS.reduce((acc, d) => acc + d.routes.length, 0);
  const avgRoutes = Math.round(totalRoutes / DEPARTMENTS.length);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="font-semibold text-2xl text-text-heading">Department Breakdown</h2>
        <p className="mt-1 text-text-secondary">
          All {DEPARTMENTS.length} core operational modules with their routes, role requirements,
          and access levels
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {DEPARTMENTS.map((dept) => (
          <Card key={dept.id} className="overflow-hidden">
            {/* Header with department color */}
            <div className="h-1" style={{ backgroundColor: dept.color }} />

            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${dept.color}20` }}
                >
                  <Building2 className="h-5 w-5" style={{ color: dept.color }} />
                </div>
                <div>
                  <CardTitle className="text-lg text-text-heading">{dept.name}</CardTitle>
                  <CardDescription className="text-xs">/{dept.slug}</CardDescription>
                </div>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{dept.description}</p>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Routes */}
              <div className="space-y-2">
                <div className="font-medium text-text-muted text-xs uppercase tracking-wider">
                  Routes ({dept.routes.length})
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {dept.routes.map((route) => (
                    <div
                      key={route.path}
                      className="flex items-center gap-2 rounded bg-bg-tertiary px-2 py-1.5 text-xs"
                    >
                      <span className="text-text-muted">{routeIcons[route.name]}</span>
                      <span className="truncate text-text-secondary" title={route.description}>
                        {route.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div className="mt-4 space-y-2">
                <div className="font-medium text-text-muted text-xs uppercase tracking-wider">
                  Required Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dept.roles.map((role) => (
                    <Badge
                      key={role}
                      variant={
                        role === 'admin'
                          ? 'destructive'
                          : role === 'supervisor'
                            ? 'default'
                            : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {role.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="font-bold text-3xl text-accent-green">{DEPARTMENTS.length}</div>
          <div className="text-sm text-text-secondary">Core Operational Modules</div>
        </Card>
        <Card className="p-4">
          <div className="font-bold text-3xl text-accent-blue">{totalRoutes}</div>
          <div className="text-sm text-text-secondary">Total Department Routes</div>
        </Card>
        <Card className="p-4">
          <div className="font-bold text-3xl text-accent-blue">
            {new Set(DEPARTMENTS.flatMap((d) => d.roles)).size}
          </div>
          <div className="text-sm text-text-secondary">Unique RBAC Roles</div>
        </Card>
        <Card className="p-4">
          <div className="font-bold text-3xl text-accent-amber">{avgRoutes}</div>
          <div className="text-sm text-text-secondary">Avg Routes per Module</div>
        </Card>
      </div>
    </div>
  );
}
