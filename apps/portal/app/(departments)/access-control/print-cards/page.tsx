import { getEmployeeCardProfiles, getNeo300PrinterStatus, getRecentNeo300Jobs } from "./actions";
import { Neo300PrintStudio } from "./neo300-print-studio";

export const dynamic = "force-dynamic";

export default async function PrintCardsPage() {
  const [printer, employees, jobs] = await Promise.all([
    getNeo300PrinterStatus(),
    getEmployeeCardProfiles(),
    getRecentNeo300Jobs(15),
  ]);

  return (
    <Neo300PrintStudio initialPrinter={printer} initialEmployees={employees} initialJobs={jobs} />
  );
}
