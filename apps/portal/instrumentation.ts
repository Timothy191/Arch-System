export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-base");
    const { registerOTel } = await import("@vercel/otel");

    const exporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
    });

    registerOTel({
      serviceName: "portal-ui",
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
  }
}
