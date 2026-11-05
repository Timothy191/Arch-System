import { z } from 'zod';

export const embedDashboardSchema = z.object({
  dashboardId: z.coerce.number().positive('Dashboard ID must be a positive integer'),
  departmentId: z.string().optional(),
});

export type EmbedDashboardInput = z.infer<typeof embedDashboardSchema>;
