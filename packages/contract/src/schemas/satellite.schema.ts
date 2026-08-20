import { z } from "zod";
import { uuidSchema, dateSchema } from "./common.schema.js";

// AGENT-TRACE: Zod schema for InSAR GeoTIFF metadata upload
export const insarGeoTIFFUploadSchema = z.object({
  department_id: uuidSchema,
  satellite_name: z.enum(["Sentinel-1", "TerraSAR-X", "Capella", "PAZ"]),
  pass_direction: z.enum(["ascending", "descending"]),
  acquisition_date: dateSchema,
  reference_date: dateSchema,
  location_name: z.string().min(1).max(255),
  min_lat: z.number().min(-90).max(90),
  max_lat: z.number().min(-90).max(90),
  min_lon: z.number().min(-180).max(180),
  max_lon: z.number().min(-180).max(180),
  max_displacement_mm: z.number(),
  coherence_threshold: z.number().min(0).max(1).default(0.4),
  cog_url: z.string().url().optional(),
});

export type InsarGeoTIFFUploadInput = z.input<typeof insarGeoTIFFUploadSchema>;

// AGENT-TRACE: Zod schema for spatial deformation point ingestion
export const insarTelemetryIngestSchema = z.object({
  department_id: uuidSchema,
  satellite_name: z.enum(["Sentinel-1", "TerraSAR-X", "Capella", "PAZ"]),
  acquisition_date: dateSchema,
  reference_date: dateSchema,
  location_name: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  displacement_mm: z.number(),
  coherence_index: z.number().min(0).max(1),
  risk_level: z.enum(["none", "minor", "moderate", "critical"]).optional(),
  cog_url: z.string().url().optional(),
});

export type InsarTelemetryIngestInput = z.infer<typeof insarTelemetryIngestSchema>;
