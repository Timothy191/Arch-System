import { z } from "zod";

export const adminDataQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  order_by: z.string().max(100).optional().default("created_at"),
  order_dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const adminDataUpdateSchema = z.object({
  id: z.string().min(1, "Record id is required"),
  data: z.record(z.string(), z.unknown()),
});

export const adminDataDeleteSchema = z.object({
  id: z.string().min(1, "Record id is required"),
});

export const adminAddSiteSchema = z.object({
  name: z.string().min(1, "Site name is required"),
  site_code: z.string().min(1, "Site code is required"),
  active: z.boolean().optional().default(true),
});

export const adminUpdateSiteSchema = z.object({
  name: z.string().min(1, "Site name cannot be empty").optional(),
  site_code: z.string().min(1, "Site code cannot be empty").optional(),
  active: z.boolean().optional(),
});
