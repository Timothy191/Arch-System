import { redirect } from "next/navigation";
import { requireDepartment } from "~/lib/dept-context";

export default async function OperationalDelaysPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  requireDepartment(department, "control-room");

  // AGENT-TRACE: Redirect to machine operations page since delay tracking is now integrated
  // The old operational_delays table has been deprecated in favor of delay_entries
  redirect(`/${department}/machine-operations`);
}
