import { DEPARTMENTS } from "../lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Building2,
  LayoutDashboard,
  FileText,
  Settings,
  History,
  BarChart3,
  Wrench,
  Satellite,
  Image,
  Layers,
  AlertTriangle,
  Users,
  RefreshCw,
  Cpu,
  Truck,
} from "lucide-react";

const routeIcons: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="w-4 h-4" />,
  "Daily Log": <FileText className="w-4 h-4" />,
  Machines: <Settings className="w-4 h-4" />,
  History: <History className="w-4 h-4" />,
  Reports: <BarChart3 className="w-4 h-4" />,
  Tools: <Wrench className="w-4 h-4" />,
  "SAR Analysis": <Satellite className="w-4 h-4" />,
  "High-Res Imagery": <Image className="w-4 h-4" />,
  Hyperspectral: <Layers className="w-4 h-4" />,
  "Operational Delays": <AlertTriangle className="w-4 h-4" />,
  "Shift Coverage": <Users className="w-4 h-4" />,
  "Roll Over": <RefreshCw className="w-4 h-4" />,
  Breakdowns: <Wrench className="w-4 h-4" />,
  "Engineering Notes": <FileText className="w-4 h-4" />,
  "Machine Operations": <Cpu className="w-4 h-4" />,
  "Hourly Loads": <Truck className="w-4 h-4" />,
  "Excavator Activity": <Cpu className="w-4 h-4" />,
};

export default function DepartmentBreakdown() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-text-heading">Department Breakdown</h2>
        <p className="text-text-secondary mt-1">
          All {DEPARTMENTS.length} departments with their routes, role requirements, and access
          levels
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {DEPARTMENTS.map((dept) => (
          <Card key={dept.id} className="overflow-hidden">
            {/* Header with department color */}
            <div className="h-1" style={{ backgroundColor: dept.color }} />

            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${dept.color}20` }}
                >
                  <Building2 className="w-5 h-5" style={{ color: dept.color }} />
                </div>
                <div>
                  <CardTitle className="text-lg text-text-heading">{dept.name}</CardTitle>
                  <CardDescription className="text-xs">/{dept.slug}</CardDescription>
                </div>
              </div>
              <p className="text-sm text-text-secondary mt-2">{dept.description}</p>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Routes */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Routes
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {dept.routes.map((route) => (
                    <div
                      key={route.path}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-tertiary text-xs"
                    >
                      <span className="text-text-muted">{routeIcons[route.name]}</span>
                      <span className="text-text-secondary truncate" title={route.description}>
                        {route.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Required Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dept.roles.map((role) => (
                    <Badge
                      key={role}
                      variant={
                        role === "admin"
                          ? "destructive"
                          : role === "supervisor"
                            ? "default"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {role.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-3xl font-bold text-accent-green">{DEPARTMENTS.length}</div>
          <div className="text-sm text-text-secondary">Total Departments</div>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-accent-blue">
            {DEPARTMENTS.reduce((acc, d) => acc + d.routes.length, 0)}
          </div>
          <div className="text-sm text-text-secondary">Total Routes</div>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-accent-blue">
            {new Set(DEPARTMENTS.flatMap((d) => d.roles)).size}
          </div>
          <div className="text-sm text-text-secondary">Unique Roles</div>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-accent-amber">6</div>
          <div className="text-sm text-text-secondary">Routes per Department</div>
        </Card>
      </div>
    </div>
  );
}
