import { DEPARTMENTS } from "@/lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  LayoutDashboard,
  FileText,
  Settings,
  History,
  BarChart3,
  Wrench,
} from "lucide-react";

const routeIcons: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="w-4 h-4" />,
  "Daily Log": <FileText className="w-4 h-4" />,
  Machines: <Settings className="w-4 h-4" />,
  History: <History className="w-4 h-4" />,
  Reports: <BarChart3 className="w-4 h-4" />,
  Tools: <Wrench className="w-4 h-4" />,
};

export default function DepartmentBreakdown() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#fafafa]">
          Department Breakdown
        </h2>
        <p className="text-[#b4b4b4] mt-1">
          All 7 departments with their routes, role requirements, and access
          levels
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {DEPARTMENTS.map((dept) => (
          <Card
            key={dept.id}
            className="bg-[#171717] border-[#363636] overflow-hidden"
          >
            {/* Header with department color */}
            <div className="h-1" style={{ backgroundColor: dept.color }} />

            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${dept.color}20` }}
                >
                  <Building2
                    className="w-5 h-5"
                    style={{ color: dept.color }}
                  />
                </div>
                <div>
                  <CardTitle className="text-lg text-[#fafafa]">
                    {dept.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    /{dept.slug}
                  </CardDescription>
                </div>
              </div>
              <p className="text-sm text-[#b4b4b4] mt-2">{dept.description}</p>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Routes */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#898989] uppercase tracking-wider">
                  Routes
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {dept.routes.map((route) => (
                    <div
                      key={route.path}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#242424] text-xs"
                    >
                      <span className="text-[#898989]">
                        {routeIcons[route.name]}
                      </span>
                      <span
                        className="text-[#b4b4b4] truncate"
                        title={route.description}
                      >
                        {route.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium text-[#898989] uppercase tracking-wider">
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
        <div className="glass-card p-4 rounded-xl">
          <div className="text-3xl font-bold text-[#3ecf8e]">
            {DEPARTMENTS.length}
          </div>
          <div className="text-sm text-[#b4b4b4]">Total Departments</div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="text-3xl font-bold text-[#60a5fa]">
            {DEPARTMENTS.reduce((acc, d) => acc + d.routes.length, 0)}
          </div>
          <div className="text-sm text-[#b4b4b4]">Total Routes</div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="text-3xl font-bold text-[#007aff]">
            {new Set(DEPARTMENTS.flatMap((d) => d.roles)).size}
          </div>
          <div className="text-sm text-[#b4b4b4]">Unique Roles</div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="text-3xl font-bold text-[#a78bfa]">6</div>
          <div className="text-sm text-[#b4b4b4]">Routes per Department</div>
        </div>
      </div>
    </div>
  );
}
