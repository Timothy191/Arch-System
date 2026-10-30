import { z } from 'zod';

export const monthlyMachineSnapshotSchema = z.object({
  id: z.string().uuid().optional(),
  departmentId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  shiftType: z.enum(['day', 'night', 'all']),
  machineCount: z.number().int().min(0),
  totalSmrWorked: z.number().min(0),
  fleetAvailabilityPercent: z.number().min(0).max(100),
  fleetUtilizationPercent: z.number().min(0).max(100),
  totalBreakdownHours: z.number().min(0),
  isSealed: z.boolean().default(true),
  sealedAt: z.string().datetime().optional(),
  sealedBy: z.string().uuid().nullable().optional(),
  records: z.array(z.record(z.string(), z.unknown())).default([]),
  summaries: z.array(z.record(z.string(), z.unknown())).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const saveMonthlyMachineSnapshotInputSchema = z.object({
  departmentId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  shiftType: z.enum(['day', 'night', 'all']),
  machineCount: z.number().int().min(0),
  totalSmrWorked: z.number().min(0),
  fleetAvailabilityPercent: z.number().min(0).max(100),
  fleetUtilizationPercent: z.number().min(0).max(100),
  totalBreakdownHours: z.number().min(0),
  isSealed: z.boolean().default(true),
  records: z.array(z.record(z.string(), z.unknown())).default([]),
  summaries: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type MonthlyMachineSnapshot = z.infer<typeof monthlyMachineSnapshotSchema>;
export type SaveMonthlyMachineSnapshotInput = z.infer<typeof saveMonthlyMachineSnapshotInputSchema>;
