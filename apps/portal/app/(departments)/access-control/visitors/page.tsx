import { getDepartmentContext } from "~/lib/dept-context";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { GlassCard } from "@repo/ui/GlassCard";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Users, Plus, Clock } from "lucide-react";
import { getVisitorsForDepartment } from "../actions";

export const dynamic = "force-dynamic";

export default async function VisitorsPage() {
  const { deptId } = await getDepartmentContext({
    department: "access-control",
  });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-6">
        <p className="text-[var(--text-muted)]">
          Please log in to view visitors.
        </p>
      </div>
    );
  }

  const visitors = await getVisitorsForDepartment(deptId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">
            Visitor Management
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Register guests, assign temporary credentials, and track site hosts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form (Left, 1 col) */}
        <div className="lg:col-span-1 space-y-4">
          <GlassCard>
            <div className="flex items-center space-x-2 mb-6">
              <div className="p-2 bg-[var(--accent-cyan)]/10 rounded-lg">
                <Users className="w-5 h-5 text-[var(--accent-cyan)]" />
              </div>
              <h3 className="font-semibold text-[var(--text-heading)]">
                New Registration
              </h3>
            </div>

            <form className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="first_name"
                  className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block"
                >
                  First Name
                </label>
                <Input
                  id="first_name"
                  placeholder="John"
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)]"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="surname"
                  className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block"
                >
                  Surname
                </label>
                <Input
                  id="surname"
                  placeholder="Doe"
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)]"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="company"
                  className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block"
                >
                  Company / Agency
                </label>
                <Input
                  id="company"
                  placeholder="Acme Corp"
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)]"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="reason"
                  className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block"
                >
                  Reason for Visit
                </label>
                <Input
                  id="reason"
                  placeholder="Maintenance, Audit, etc."
                  className="bg-[var(--bg-tertiary)] border-[var(--border-default)]"
                />
              </div>

              <div className="pt-4">
                <Button className="w-full bg-accent-cyan text-bg-secondary hover:bg-accent-cyan/90 shadow-diffusion-cyan">
                  <Plus className="w-4 h-4 mr-2" />
                  Register & Issue Badge
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>

        {/* Active Visitors Table (Right, 2 cols) */}
        <div className="lg:col-span-2">
          <GlassCard className="p-0 overflow-hidden h-full">
            <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 flex justify-between items-center">
              <h3 className="font-semibold text-[var(--text-heading)] flex items-center">
                <Clock className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                Today&apos;s Visitors
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-default)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-muted)]">
                    Visitor Name
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)]">
                    Company
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)]">
                    Reason
                  </TableHead>
                  <TableHead className="text-[var(--text-muted)]">
                    Check-In
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-muted)]">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitors.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-[var(--text-muted)]"
                    >
                      No visitors found for this department.
                    </TableCell>
                  </TableRow>
                )}
                {visitors.map((visitor) => (
                  <TableRow
                    key={visitor.id}
                    className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <TableCell className="font-medium text-[var(--text-heading)]">
                      {visitor.first_name} {visitor.surname}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {visitor.company || "—"}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {visitor.reason_for_entry || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[var(--text-secondary)]">
                      {visitor.check_in_time
                        ? new Date(visitor.check_in_time).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            },
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {visitor.status === "Checked In" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50/70 border-emerald-200/50 text-emerald-700">
                          <span className="badge-pulse-dot bg-emerald-500" />
                          Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-default)]">
                          {visitor.status || "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
