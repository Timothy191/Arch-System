import { createServiceRoleClient } from '@repo/supabase/service-role';
import { inngest } from '@repo/utils/inngest';
import { logError } from '@/lib/errors/error-logger';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

/**
 * Orphaned Record Detection Job
 *
 * Runs daily at 02:00 to detect data integrity issues where records
 * reference non-existent machines or have missing relationships.
 *
 * Schedule: Daily at 02:00
 * Checks:
 * - Machine operations without valid machine_id
 * - Hourly loads without matching machine operation
 * Action: Flag for admin review, create cleanup job
 */

export const orphanedRecordDetectionFn = inngest.createFunction(
  {
    id: 'orphaned-record-detection',
    triggers: [{ cron: '0 2 * * *' }],
  },
  async () => {
    const serviceRole = createServiceRoleClient();
    const start = performance.now();
    let success = true;
    const issues: { type: string; count: number; details: string[] }[] = [];

    try {
      const [
        { data: machines, error: machinesError },
        { data: operators, error: operatorsError },
        { data: departments, error: departmentsError },
        { data: machineOps, error: opsError },
        { data: hourlyLoads, error: loadsError },
        { data: shiftStatuses, error: shiftError },
      ] = await Promise.all([
        serviceRole.from('machines').select('id, active'),
        serviceRole.from('operators').select('id'),
        serviceRole.from('departments').select('id'),
        serviceRole.from('machine_operations').select('id, machine_id, operator_id, shift_date'),
        serviceRole.from('hourly_loads').select('id, machine_id, load_date, shift_type'),
        serviceRole.from('shift_status').select('id, department_id, shift_date'),
      ]);

      if (machinesError) throw machinesError;
      if (operatorsError) throw operatorsError;
      if (departmentsError) throw departmentsError;
      if (opsError) throw opsError;
      if (loadsError) throw loadsError;
      if (shiftError) throw shiftError;

      const allMachineIds = new Set((machines ?? []).map((m) => m.id));
      const activeMachineIds = new Set((machines ?? []).filter((m) => m.active).map((m) => m.id));
      const validOperatorIds = new Set((operators ?? []).map((o) => o.id));
      const validDepartmentIds = new Set((departments ?? []).map((d) => d.id));

      const invalidMachineOps = (machineOps ?? []).filter(
        (op) => op.machine_id && !allMachineIds.has(op.machine_id)
      );
      if (invalidMachineOps.length > 0) {
        issues.push({
          type: 'invalid_machine_id_in_operations',
          count: invalidMachineOps.length,
          details: invalidMachineOps.map((op) => `ID: ${op.id}, Machine ID: ${op.machine_id}`),
        });

        await serviceRole.from('data_integrity_issues').insert(
          invalidMachineOps.map((op) => ({
            issue_type: 'orphaned_record',
            table_name: 'machine_operations',
            record_id: op.id,
            description: `Invalid machine_id: ${op.machine_id}`,
            severity: 'high',
            created_at: new Date().toISOString(),
          }))
        );
      }

      const orphanedLoads = (hourlyLoads ?? []).filter(
        (load) => load.machine_id && !activeMachineIds.has(load.machine_id)
      );
      if (orphanedLoads.length > 0) {
        issues.push({
          type: 'hourly_loads_orphaned_machine',
          count: orphanedLoads.length,
          details: orphanedLoads.map(
            (load) => `ID: ${load.id}, Machine ID: ${load.machine_id}, Date: ${load.load_date}`
          ),
        });

        await serviceRole.from('data_integrity_issues').insert(
          orphanedLoads.map((load) => ({
            issue_type: 'orphaned_record',
            table_name: 'hourly_loads',
            record_id: load.id,
            description: `Machine not active or doesn't exist: ${load.machine_id}`,
            severity: 'medium',
            created_at: new Date().toISOString(),
          }))
        );
      }

      const invalidOps = (machineOps ?? []).filter(
        (op) => op.operator_id && !validOperatorIds.has(op.operator_id)
      );
      if (invalidOps.length > 0) {
        issues.push({
          type: 'invalid_operator_id_in_operations',
          count: invalidOps.length,
          details: invalidOps.map((op) => `ID: ${op.id}, Operator ID: ${op.operator_id}`),
        });

        await serviceRole.from('data_integrity_issues').insert(
          invalidOps.map((op) => ({
            issue_type: 'orphaned_record',
            table_name: 'machine_operations',
            record_id: op.id,
            description: `Invalid operator_id: ${op.operator_id}`,
            severity: 'high',
            created_at: new Date().toISOString(),
          }))
        );
      }

      const invalidShiftStatus = (shiftStatuses ?? []).filter(
        (shift) => shift.department_id && !validDepartmentIds.has(shift.department_id)
      );
      if (invalidShiftStatus.length > 0) {
        issues.push({
          type: 'invalid_department_id_in_shift_status',
          count: invalidShiftStatus.length,
          details: invalidShiftStatus.map(
            (shift) => `ID: ${shift.id}, Dept ID: ${shift.department_id}`
          ),
        });

        await serviceRole.from('data_integrity_issues').insert(
          invalidShiftStatus.map((shift) => ({
            issue_type: 'orphaned_record',
            table_name: 'shift_status',
            record_id: shift.id,
            description: `Invalid department_id: ${shift.department_id}`,
            severity: 'high',
            created_at: new Date().toISOString(),
          }))
        );
      }

      const result = {
        success: true,
        issues_found: issues.length,
        issues,
        total_issues: issues.reduce((sum, issue) => sum + issue.count, 0),
      };

      return result;
    } catch (err) {
      success = false;
      logError(err, {
        context: 'orphaned_record_detection_job',
      });
      throw err;
    } finally {
      recordJobExecution('orphaned-record-detection', performance.now() - start, success);
    }
  }
);
