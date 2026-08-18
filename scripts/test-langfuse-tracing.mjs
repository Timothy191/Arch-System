import { Langfuse } from "langfuse";

const publicKey = process.env.LANGFUSE_PUBLIC_KEY || "pk-lf-117fca39-caf7-45b3-a348-5bb51f3f567f";
const secretKey = process.env.LANGFUSE_SECRET_KEY || "sk-lf-4e73ef76-9691-482a-b1ab-1abf54dbe1e8";
const baseUrl = process.env.LANGFUSE_BASE_URL || "https://us.cloud.langfuse.com";

console.log("Connecting to Langfuse at:", baseUrl);

const langfuse = new Langfuse({
  publicKey,
  secretKey,
  baseUrl,
  flushAt: 1,
});

async function main() {
  const sessionId = `session-${Date.now()}`;
  console.log(`Creating trace in session: ${sessionId}...`);

  const trace = langfuse.trace({
    name: "operational-coordinator-sample",
    sessionId,
    userId: "admin-user",
    tags: ["arch-systems", "verification", "sample-run"],
    input: {
      goal: "Generate shift handover report and machine anomaly analysis",
      department: "control-room",
      timestamp: new Date().toISOString(),
    },
    metadata: {
      site: "Main Pit (PIT-01)",
      shift: "Day Shift",
    },
  });

  // Span 1: SCADA Data Retrieval
  const scadaSpan = trace.span({
    name: "fetch-scada-telemetry",
    input: { machineTypes: ["Generator", "Dump Truck"], interval: "1h" },
    metadata: { source: "fuxa-scada-gateway" },
  });
  // Simulate retrieval
  await new Promise((r) => setTimeout(r, 150));
  scadaSpan.end({
    output: { status: "OK", telemetryPoints: 128, activeGenerators: 4 },
  });

  // Generation 1: Specialist Analysis
  const analysisGen = trace.generation({
    name: "specialist-anomaly-analysis",
    model: "gpt-4o-mini",
    modelParameters: { temperature: 0.2 },
    input: "Analyze generator telemetry for temperature variance > 10% from baseline",
  });
  await new Promise((r) => setTimeout(r, 200));
  analysisGen.end({
    output:
      "Generators GEN001, GEN006, GEN007, GEN009 operating within nominal temperature thresholds (68-72°C). Zero active critical alarms.",
    usage: {
      promptTokens: 42,
      completionTokens: 38,
      totalTokens: 80,
    },
  });

  // Generation 2: Synthesis Orchestrator
  const synthesisGen = trace.generation({
    name: "orchestrator-synthesis",
    model: "gpt-4o",
    modelParameters: { temperature: 0.3 },
    input: "Synthesize operational report and telemetry metrics into executive summary",
  });
  await new Promise((r) => setTimeout(r, 250));
  synthesisGen.end({
    output:
      "Shift Handover Summary: All 4 generators and primary fleet operational. Nominal fuel consumption. Shift closed with 0 safety incidents.",
    usage: {
      promptTokens: 120,
      completionTokens: 64,
      totalTokens: 184,
    },
  });

  trace.update({
    output: {
      status: "COMPLETED",
      summary: "Executive handover report generated successfully",
      traceId: trace.id,
    },
  });

  console.log("Flushing trace to Langfuse...");
  await langfuse.flushAsync();
  console.log("✅ Successfully sent trace to Langfuse US Cloud!");
  console.log("Trace ID:", trace.id);
  console.log(`View live at: https://us.cloud.langfuse.com/project/trace/${trace.id}`);
}

main().catch((err) => {
  console.error("❌ Langfuse trace ingestion failed:", err);
  process.exit(1);
});
