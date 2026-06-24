export async function pushAuthTelemetry(name: string): Promise<void> {
  try {
    await fetch("/api/telemetry/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, value: 1 }),
    });
  } catch {
    // fire-and-forget
  }
}
