import { z } from 'zod';
import { uuidSchema } from './common.schema';

export const embedDashboardSchema = z.object({
  dashboardId: z.coerce.number().positive('Dashboard ID must be a positive integer'),
  departmentId: z.string().optional(),
});

export type EmbedDashboardInput = z.infer<typeof embedDashboardSchema>;
