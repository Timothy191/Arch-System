import { z } from 'zod';

export const departmentAccessLevelSchema = z.enum(['read', 'operate', 'supervise', 'manage']);

export const employeeDepartmentAccessSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  departmentId: z.string().uuid(),
  accessLevel: departmentAccessLevelSchema,
  grantedAt: z.string().datetime().optional(),
  grantedBy: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type DepartmentAccessLevel = z.infer<typeof departmentAccessLevelSchema>;
export type EmployeeDepartmentAccess = z.infer<typeof employeeDepartmentAccessSchema>;
