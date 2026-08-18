import type { z } from "zod";
import type {
  shiftCompletenessSchema,
  controlRoomChecklistItemSchema,
  controlRoomChecklistSchema,
  controlRoomShiftReportSchema,
} from "../schemas/control-room.schema.js";

export type ShiftCompletenessInput = z.infer<typeof shiftCompletenessSchema>;
export type ControlRoomChecklistItem = z.infer<typeof controlRoomChecklistItemSchema>;
export type ControlRoomChecklistInput = z.infer<typeof controlRoomChecklistSchema>;
export type ControlRoomShiftReportInput = z.infer<typeof controlRoomShiftReportSchema>;
