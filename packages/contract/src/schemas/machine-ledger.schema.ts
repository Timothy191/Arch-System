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
    overrun_reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Standard shift window is 12 hours, with up to 12.5h operational tolerance
    const STANDARD_SHIFT_WINDOW_HOURS = 12.0;
    const MAX_SHIFT_WINDOW_HOURS = 12.5;

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

    if (total_allocated > MAX_SHIFT_WINDOW_HOURS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total allocated time (${total_allocated}h) exceeds the maximum 12.5-hour shift window with operational tolerance. (Operating: ${operating_hours}h, Breakdown: ${data.breakdown_hours}h, Delays: ${data.delay_hours}h)`,
        path: ['closing_smr'], // Highlight the SMR field red
      });
    } else if (total_allocated > STANDARD_SHIFT_WINDOW_HOURS) {
      if (!data.overrun_reason || data.overrun_reason.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Overrun reason is required when total allocated time (${total_allocated}h) exceeds the standard 12.0-hour shift window (up to 12.5h operational tolerance).`,
          path: ['overrun_reason'],
        });
      }
    }
  });

export const machineLedgerCloseoutSchema = z.object({
  shift_date: nonEmptyString,
  shift_type: z.enum(['day', 'night']),
  allocations: z
    .array(machineTimeAllocationSchema)
    .min(1, 'At least one machine must be allocated'),
});
