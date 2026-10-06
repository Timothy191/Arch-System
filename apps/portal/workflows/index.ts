import { handleAutonomousComplianceAudit } from './autonomous-compliance-audit';
import { handleEquipmentBreakdown } from './equipment-maintenance';
import { handleShiftReport } from './shift-report-compiler';
import { handleUserSignup } from './user-signup';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  file: string;
  entryFunction: string;
  handler: (...args: any[]) => Promise<any>;
}

export const WORKFLOW_REGISTRY: Record<string, WorkflowDefinition> = {
  'autonomous-compliance-audit': {
    id: 'autonomous-compliance-audit',
    name: 'AutonomousComplianceAudit Workflow',
    description:
      'Periodically audits safety logs and alerts mining supervisors on compliance drift',
    file: 'autonomous-compliance-audit.ts',
    entryFunction: 'handleAutonomousComplianceAudit',
    handler: handleAutonomousComplianceAudit,
  },

  'equipment-breakdown': {
    id: 'equipment-breakdown',
    name: 'Equipment Breakdown Workflow',
    description: 'Notifies engineering, waits 24h, and escalates to supervisor if still broken.',
    file: 'equipment-maintenance.ts',
    entryFunction: 'handleEquipmentBreakdown',
    handler: handleEquipmentBreakdown,
  },
  'shift-report': {
    id: 'shift-report',
    name: 'Shift Report Compiler',
    description: 'Compiles SCADA telemetry into shift reports and alerts management.',
    file: 'shift-report-compiler.ts',
    entryFunction: 'handleShiftReport',
    handler: handleShiftReport,
  },
  'user-signup': {
    id: 'user-signup',
    name: 'User Signup Onboarding',
    description:
      'Creates user, dispatches welcome email, sleeps 5s, and sends onboarding follow-up.',
    file: 'user-signup.ts',
    entryFunction: 'handleUserSignup',
    handler: handleUserSignup,
  },
};

export {
  handleAutonomousComplianceAudit,
  handleEquipmentBreakdown,
  handleShiftReport,
  handleUserSignup,
};
