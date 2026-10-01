import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.schema';

export const machineTimeAllocationSchema = z
  .object({
    machine_id: uuidSchema,
    machine_name: nonEmptyString,
    opening_smr: z.number().nonnegative(),
    closing_smr: z.number().nonnegative(),
    breakdown_hours: z.number().nonnegative().default(0),
    delay_hours: z.number().nonnegative().default(0),
    delay_reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Total shift window is exactly 12 hours
    const SHIFT_WINDOW_HOURS = 12;

    // Operating SMR = difference between closing and opening
    const operating_hours = data.closing_smr - data.opening_smr;

    if (operating_hours < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Closing SMR cannot be less than Opening SMR',
        path: ['closing_smr'],
      });
      return;
    }

    // Total allocated hours for the shift
    const total_allocated = operating_hours + data.breakdown_hours + data.delay_hours;

    if (total_allocated > SHIFT_WINDOW_HOURS) {
      // If engineering logged 6 hours breakdown, max operating SMR allowed is 6 hours (because 6 + 6 = 12)
      // If they log 7 operating hours and 6 breakdown hours = 13 > 12 -> BLOCK.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total allocated time (${total_allocated}h) exceeds the maximum 12-hour shift window. (Operating: ${operating_hours}h, Breakdown: ${data.breakdown_hours}h, Delays: ${data.delay_hours}h)`,
        path: ['closing_smr'], // Highlight the SMR field red
      });
    }
  });

export const machineLedgerCloseoutSchema = z.object({
  shift_date: nonEmptyString,
  shift_type: z.enum(['day', 'night']),
  allocations: z
    .array(machineTimeAllocationSchema)
    .min(1, 'At least one machine must be allocated'),
});
