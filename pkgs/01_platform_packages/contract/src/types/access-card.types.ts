import type { z } from "zod";
import type {
  EmployeeProfileUpdateSchema,
  PrintRequestSchema,
} from "../schemas/access-card.schema";

export type EmployeeProfileUpdateInput = z.infer<typeof EmployeeProfileUpdateSchema>;
export type PrintRequestInput = z.infer<typeof PrintRequestSchema>;
