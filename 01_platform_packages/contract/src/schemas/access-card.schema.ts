import { z } from "zod";
import { uuidSchema, dateSchema, nonEmptyString } from "./common.schema";

export const EmployeeProfileUpdateSchema = z.object({
  first_name: nonEmptyString,
  last_name: nonEmptyString,
  national_id: nonEmptyString,
  job_title: nonEmptyString,
  areas: z.array(z.string()).default([]),
  medical_expiry_date: dateSchema.nullable().optional(),
  induction_expiry_date: dateSchema.nullable().optional(),
  qr_code_data: z.string().nullable().optional(),
  photo_url: z.string().url("Must be a valid URL").nullable().optional(),
});

export const PrintRequestSchema = z.object({
  employee_id: uuidSchema,
  magnetic_stripe_data: z.string().max(104, "Magnetic stripe data is too long").optional(),
  holokote_id: z.string().optional(),
  print_copies: z.number().int().min(1).max(5).default(1),
});
