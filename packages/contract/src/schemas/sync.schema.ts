import { z } from "zod";

export const syncPlaybackSchema = z.object({
  idempotencyKey: z.string().min(1),
  actionType: z.enum([
    "ADD_BREAKDOWN",
    "CREATE_BREAKDOWN",
    "RESOLVE_BREAKDOWN",
    "ADD_DAILY_LOG",
    "create_breakdown",
    "update_breakdown",
    "update_safety_incident",
    "create_daily_log",
    "update_daily_log",
  ]),
  payload: z.record(z.string(), z.unknown()),
  departmentId: z.string().min(1),
});
