/**
 * Anomaly Detection Script
 * Usage: node tools/anomaly-detector.mjs [--notify]
 *
 * Detects anomalies in key metrics using statistical methods
 * - Z-score: for normally distributed metrics
 * - Threshold: for absolute limits
 * - Percentile: for comparing against historical distribution
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const CONFIG_PATH = join(rootDir, "config/anomaly-detection.json");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadConfig() {
  const content = readFileSync(CONFIG_PATH, "utf-8");
  return content.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || "");
}

// Statistical functions
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  const squaredDiffs = arr.map((x) => Math.pow(x - m, 2));
  return Math.sqrt(mean(squaredDiffs));
}

function zscore(value, arr) {
  const m = mean(arr);
  const s = stddev(arr);
  return s === 0 ? 0 : (value - m) / s;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

// Simulated metric fetch - in production, query Prometheus/Datadog
function getMetricData(metricName, window) {
  // Mock data - replace with actual metric queries
  const mockData = {
    api_latency_ms: [120, 135, 110, 125, 140, 130, 115, 145, 125, 120, 180, 130, 125, 140],
    error_rate: [0.1, 0.2, 0.15, 0.1, 0.3, 0.2, 0.15, 0.1, 0.25, 0.2],
    cpu_usage: [45, 52, 48, 55, 50, 58, 62, 75, 55, 50],
    memory_usage: [60, 58, 62, 65, 63, 68, 70, 72, 65, 60],
    db_connections: [45, 50, 48, 52, 55, 58, 60, 85, 62, 55],
    request_count: [1000, 1200, 950, 1100, 1300, 1150, 1050, 900, 1100, 1200],
  };
  return mockData[metricName] || [];
}

function detectAnomaly(metricName, currentValue, config) {
  const history = getMetricData(metricName, config.window);

  if (history.length < (config.minDataPoints || 5)) {
    return { detected: false, reason: "insufficient_data" };
  }

  switch (config.algorithm) {
    case "zscore": {
      const score = zscore(currentValue, history);
      if (Math.abs(score) > config.threshold) {
        return {
          detected: true,
          severity: Math.abs(score) > config.threshold * 1.5 ? "critical" : "warning",
          score: score.toFixed(2),
          reason: `Z-score ${score.toFixed(2)} exceeds threshold ${config.threshold}`,
        };
      }
      break;
    }
    case "threshold": {
      if (currentValue > config.threshold) {
        return {
          detected: true,
          severity: currentValue > config.threshold * 1.5 ? "critical" : "warning",
          value: currentValue,
          threshold: config.threshold,
          reason: `Value ${currentValue} exceeds threshold ${config.threshold}`,
        };
      }
      break;
    }
    case "percentile": {
      const p10 = percentile(history, config.lowerThreshold || 10);
      const p90 = percentile(history, config.upperThreshold || 90);
      if (currentValue < p10 || currentValue > p90) {
        return {
          detected: true,
          severity: "warning",
          value: currentValue,
          range: [p10, p90],
          reason: `Value ${currentValue} outside historical range [${p10.toFixed(0)}, ${p90.toFixed(0)}]`,
        };
      }
      break;
    }
  }

  return { detected: false };
}

async function main() {
  const NOTIFY = process.argv.includes("--notify");
  log("Starting anomaly detection...");

  const config = JSON.parse(loadConfig());
  const anomalies = [];

  // Check each metric
  for (const [metricName, metricConfig] of Object.entries(config.metrics)) {
    // Get current value (mock - would be real metric query)
    const currentValue = getMetricData(metricName, "5m")[
      getMetricData(metricName, "5m").length - 1
    ];

    const result = detectAnomaly(metricName, currentValue, metricConfig);

    if (result.detected) {
      anomalies.push({
        metric: metricName,
        currentValue,
        ...result,
      });
    }
  }

  if (anomalies.length > 0) {
    log(`Detected ${anomalies.length} anomaly(ies):`);
    anomalies.forEach((a) => log(`  - ${a.metric}: ${a.reason}`));

    if (NOTIFY) {
      // Send to alerting system
      log("[ALERT] Would send anomaly alert to PagerDuty/Slack");
    }
  } else {
    log("No anomalies detected");
  }
}

main().catch((err) => {
  log(`Error: ${err.message}`);
  process.exit(1);
});
