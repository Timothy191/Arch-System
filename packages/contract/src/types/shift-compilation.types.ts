import type { z } from "zod";
import type {
  lockAndSignShiftSchema,
  machinePerformanceSchema,
  shiftBreakdownSummarySchema,
  shiftTireEventSchema,
  unifiedShiftReportSchema,
} from "../schemas/shift-compilation.schema.js";

export type MachinePerformance = z.infer<typeof machinePerformanceSchema>;
export type ShiftBreakdownSummary = z.infer<typeof shiftBreakdownSummarySchema>;
export type ShiftTireEvent = z.infer<typeof shiftTireEventSchema>;
export type UnifiedShiftReport = z.infer<typeof unifiedShiftReportSchema>;
export type LockAndSignShiftInput = z.infer<typeof lockAndSignShiftSchema>;
