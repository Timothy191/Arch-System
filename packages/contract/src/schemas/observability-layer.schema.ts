import { z } from 'zod';

export const serviceConnectionModeSchema = z.enum(['live', 'fallback', 'unconfigured']);
export type ServiceConnectionMode = z.infer<typeof serviceConnectionModeSchema>;

export const observabilityServiceStatusSchema = z.object({
  id: z.enum(['otel-collector', 'prometheus', 'grafana', 'woodpecker']),
  label: z.string().min(1),
  mode: serviceConnectionModeSchema,
  latencyMs: z.number().nonnegative().nullable(),
  endpointConfigured: z.boolean(),
  detail: z.string(),
});
export type ObservabilityServiceStatus = z.infer<typeof observabilityServiceStatusSchema>;

export const prometheusMetricSampleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  query: z.string().min(1),
  value: z.number().nullable(),
  unit: z.string(),
  source: serviceConnectionModeSchema,
});
export type PrometheusMetricSample = z.infer<typeof prometheusMetricSampleSchema>;

export const grafanaDashboardEntrySchema = z.object({
  uid: z.string().min(1),
  title: z.string().min(1),
  folderTitle: z.string(),
  embedUrl: z.string().nullable(),
});
export type GrafanaDashboardEntry = z.infer<typeof grafanaDashboardEntrySchema>;

export const observabilitySummaryResponseSchema = z.object({
  generatedAt: z.string().min(1),
  deploymentTarget: z.enum(['vercel', 'local']),
  services: z.array(observabilityServiceStatusSchema),
  metrics: z.array(prometheusMetricSampleSchema),
  dashboards: z.array(grafanaDashboardEntrySchema),
  cacheSnapshot: z.object({
    hits: z.number().nonnegative(),
    misses: z.number().nonnegative(),
    l1Hits: z.number().nonnegative(),
    l2Hits: z.number().nonnegative(),
    avgLatencyMs: z.number().nonnegative(),
    p95LatencyMs: z.number().nonnegative(),
  }),
});
export type ObservabilitySummaryResponse = z.infer<typeof observabilitySummaryResponseSchema>;

export const ciPipelineEntrySchema = z.object({
  id: z.union([z.string(), z.number()]),
  number: z.number().int().nonnegative().nullable(),
  branch: z.string().min(1),
  commitSha: z.string().min(1),
  message: z.string(),
  status: z.enum(['success', 'failure', 'running', 'pending', 'skipped']),
  source: z.enum(['woodpecker', 'github-status']),
  startedAt: z.string().nullable(),
  url: z.string().nullable(),
});
export type CiPipelineEntry = z.infer<typeof ciPipelineEntrySchema>;

export const observabilityCiResponseSchema = z.object({
  generatedAt: z.string().min(1),
  mode: serviceConnectionModeSchema,
  pipelines: z.array(ciPipelineEntrySchema),
});
export type ObservabilityCiResponse = z.infer<typeof observabilityCiResponseSchema>;
