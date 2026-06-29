import { registerOTel } from "@vercel/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export function register() {
  const exporter = new OTLPTraceExporter({
    // Standard OTEL collector endpoint
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
  });

  registerOTel({
    serviceName: "portal-ui",
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
}
