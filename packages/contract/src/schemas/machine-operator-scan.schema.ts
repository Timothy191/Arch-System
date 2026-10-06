import { z } from 'zod';

const scannedCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/ -]*$/);

export const machineOperatorScanRequestSchema = z
  .object({
    departmentId: z.string().uuid(),
    machineCode: scannedCodeSchema.optional(),
    machineId: z.string().uuid().optional(),
    operatorCode: scannedCodeSchema.optional(),
    operatorId: z.string().uuid().optional(),
    siteId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.machineId || value.machineCode), 'Select or scan a machine')
  .refine(
    (value) => !(value.machineId && value.machineCode),
    'Choose either a machine selection or machine scan'
  )
  .refine(
    (value) => !(value.operatorId && value.operatorCode),
    'Choose either an operator selection or operator badge scan'
  );

const scannedMachineSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  machineType: z.string(),
  siteId: z.string().uuid().nullable(),
  requiresHourlyLoads: z.boolean(),
});

export const machineOperatorScanResponseSchema = z.discriminatedUnion('stage', [
  z.object({
    stage: z.literal('machine'),
    machine: scannedMachineSchema,
  }),
  z.object({
    stage: z.literal('operators'),
    machine: scannedMachineSchema,
    operators: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        jobTitle: z.string(),
      })
    ),
  }),
  z.object({
    stage: z.literal('assignment'),
    machine: scannedMachineSchema,
    operator: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
    operationId: z.string().uuid(),
    assignedAt: z.string().datetime(),
    alreadyAssigned: z.boolean(),
    checks: z.object({
      machineActive: z.literal(true),
      badgeValid: z.boolean(),
      badgeScanned: z.boolean(),
      operatorActive: z.literal(true),
      medicalValid: z.literal(true),
      inductionValid: z.literal(true),
      machineQualification: z.literal('not_configured'),
    }),
  }),
]);

export type MachineOperatorScanRequest = z.infer<typeof machineOperatorScanRequestSchema>;
export type MachineOperatorScanResponse = z.infer<typeof machineOperatorScanResponseSchema>;
