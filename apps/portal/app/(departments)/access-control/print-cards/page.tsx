import {
  getDepartmentsForCardStudio,
  getEmployeeCardProfiles,
  getNeo300PrinterStatus,
  getRecentNeo300Jobs,
} from './actions';
import { Neo300PrintStudio } from './neo300-print-studio';

export default async function PrintCardsPage() {
  const [printer, employees, jobs, departments] = await Promise.all([
    getNeo300PrinterStatus(),
    getEmployeeCardProfiles(),
    getRecentNeo300Jobs(15),
    getDepartmentsForCardStudio(),
  ]);

  return (
    <Neo300PrintStudio
      initialPrinter={printer}
      initialEmployees={employees}
      initialJobs={jobs}
      departments={departments}
    />
  );
}
