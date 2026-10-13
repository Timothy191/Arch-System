import { z } from 'zod';

export const machineCapabilitiesSchema = z.object({
  requiresHourlyLoads: z.boolean(),
  tracksTonnage: z.boolean(),
  tracksCycleTime: z.boolean(),
  tracksFuel: z.boolean(),
  tracksBenchClearance: z.boolean(),
  tracksDrillDepth: z.boolean(),
});

export const machineTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  requiresHourlyLoads: z.boolean(),
  tracksTonnage: z.boolean(),
  tracksCycleTime: z.boolean(),
  tracksFuel: z.boolean(),
  tracksBenchClearance: z.boolean(),
  tracksDrillDepth: z.boolean(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type MachineCapabilities = z.infer<typeof machineCapabilitiesSchema>;
export type MachineType = z.infer<typeof machineTypeSchema>;
