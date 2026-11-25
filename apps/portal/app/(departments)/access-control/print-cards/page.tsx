import { connection } from 'next/server';
import {
  getDepartmentsForCardStudio,
  getEmployeeCardProfiles,
  getFleetAndVehicleBadgeProfiles,
  getNeo300PrinterStatus,
  getRecentNeo300Jobs,
} from './actions';
import { Neo300PrintStudio } from './neo300-print-studio';

const RECENT_PRINT_JOB_LIMIT = 15;

export default async function PrintCardsPage() {
  await connection();
  const [printer, employees, jobs, departments, fleetBadges] = await Promise.all([
    getNeo300PrinterStatus(),
    getEmployeeCardProfiles(),
    getRecentNeo300Jobs(RECENT_PRINT_JOB_LIMIT),
    getDepartmentsForCardStudio(),
    getFleetAndVehicleBadgeProfiles(),
  ]);

  return (
    <Neo300PrintStudio
      initialPrinter={printer}
      initialEmployees={employees}
      initialJobs={jobs}
      departments={departments}
      initialFleetBadges={fleetBadges}
    />
  );
}
