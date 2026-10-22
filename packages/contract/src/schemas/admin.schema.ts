import { z } from 'zod';

export const adminDataQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  order_by: z.string().max(100).optional().default('created_at'),
  order_dir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const adminDataUpdateSchema = z.object({
  id: z.string().min(1, 'Record id is required'),
  data: z.record(z.string(), z.unknown()),
});

export const adminDataDeleteSchema = z.object({
  id: z.string().min(1, 'Record id is required'),
});

export const adminAddSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  site_code: z.string().min(1, 'Site code is required'),
  active: z.boolean().optional().default(true),
});

export const adminUpdateSiteSchema = z.object({
  name: z.string().min(1, 'Site name cannot be empty').optional(),
  site_code: z.string().min(1, 'Site code cannot be empty').optional(),
  active: z.boolean().optional(),
});

export const adminAddMineBlockSchema = z.object({
  name: z.string().min(1, 'Block name is required'),
  code: z.string().min(1, 'Block code is required'),
  site_id: z.string().uuid('Invalid site ID format').nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const adminUpdateMineBlockSchema = z.object({
  id: z.string().uuid('Invalid block ID format'),
  name: z.string().min(1, 'Block name cannot be empty').optional(),
  code: z.string().min(1, 'Block code cannot be empty').optional(),
  site_id: z.string().uuid('Invalid site ID format').nullable().optional(),
  active: z.boolean().optional(),
});

export const adminMineralRegistrySchema = z.object({
  waste: z.array(z.string().min(1)).min(1, 'At least one waste mineral is required'),
  coal: z.array(z.string().min(1)).min(1, 'At least one coal mineral is required'),
});

export type AdminMineralRegistry = z.infer<typeof adminMineralRegistrySchema>;
