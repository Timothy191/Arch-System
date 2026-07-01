import http from "perf/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "perf/metrics";

export const warmupPasses = new Rate("warmup_passes");
export const warmupLatency = new Trend("warmup_latency_ms");
export const warmupRequests = new Counter("warmup_requests");

export const options = {
  scenarios: [
    {
      name: "cold_pass",
      executor: "constant-vus",
      exec: "coldWarmup",
      vus: 1,
      duration: "30s",
      startTime: "0s",
    },
    {
      name: "warm_pass",
      executor: "constant-vus",
      exec: "warmWarmup",
      vus: 1,
      duration: "30s",
      startTime: "31s",
    },
    {
      name: "saturated",
      executor: "constant-vus",
      exec: "saturated",
      vus: 5,
      duration: "20s",
      startTime: "0s",
    },
  ],
  thresholds: {
    warmup_latency_ms: ["p(95)<350", "p(99)<700"],
    warmup_passes: ["rate>0.95"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL =
  __ENV.BENCH_BASE_URL || "http://localhost:3000";
const WARMUP_PATHS = [
  "/api/health/live",
  "/api/health/warmup",
  "/api/health/supabase-realtime",
];

export function coldWarmup() {
  runPass("cold");
}

export function warmWarmup() {
  runPass("warm");
}

export function saturated() {
  runPass("saturated");
  sleep(0.5);
}

function runPass(passName: string) {
  const start = Date.now();
  const failures: string[] = [];

  for (const path of WARMUP_PATHS) {
    const res = http.get(`${BASE_URL}${path}`);
    warmupRequests.add(1);
    warmupLatency.add(res.timings.duration);

    const ok = check(res, {
      [`${path}__status`]: (r) => r.status === 200,
      [`${path}__latency`]: (r) => r.timings.duration < 1200,
    });

    if (!ok) {
      failures.push(`${path} => ${res.status} (${res.timings.duration}ms)`);
    }
  }

  const passed = failures.length === 0;
  warmupPasses.add(passed ? 1 : 0);

  if (!passed) {
    console.warn(`${passName} pass failed: ${failures.join(" | ")}`);
  }
}
