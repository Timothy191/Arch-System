import { inngest } from '@repo/utils/inngest';
export const monthlyExcelReportFn = inngest.createFunction(
  {
    id: 'monthly-excel-report',
    triggers: [{ event: 'app/report.monthly' as any }],
  },
  async () => {
    return { success: true, message: 'Disabled' };
  }
);
