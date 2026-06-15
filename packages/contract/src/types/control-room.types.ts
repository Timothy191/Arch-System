import type { z } from "zod";
import type { shiftCompletenessSchema } from "../schemas/control-room.schema.js";

export type ShiftCompletenessInput = z.infer<typeof shiftCompletenessSchema>;
