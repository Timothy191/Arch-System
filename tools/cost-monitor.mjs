/**
 * Cost Monitoring Script
 * Usage: node tools/cost-monitor.mjs [--notify]
 *
 * Monitors cloud service costs against configured budgets
 * Sends alerts when thresholds are exceeded
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const CONFIG_PATH = join(rootDir, "toolchain/cost-monitoring.json");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadConfig() {
  const content = readFileSync(CONFIG_PATH, "utf-8");
  // Simple template variable replacement
  return content.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || "");
}

async function getSupabaseCosts() {
  // In production, fetch from Supabase billing API
  // https://supabase.com/dashboard/project/_/billing
  const mockCosts = {
    compute: { currentUsd: 120, prevUsd: 100 },
    bandwidth: { currentUsd: 45, prevUsd: 40 },
    storage: { currentUsd: 25, prevUsd: 22 },
  };
  return mockCosts;
}

async function getRedisCosts() {
  // Redis Cloud console or API
  const mockCosts = { instance: { currentUsd: 28, prevUsd: 25 } };
  return mockCosts;
}

function checkThresholds(category, costs, config) {
  const alerts = [];
  const categoryConfig = config.costCategories[category];

  for (const [service, budget] of Object.entries(categoryConfig)) {
    const current = costs[service]?.currentUsd || 0;
    const limit = budget.monthlyBudgetUsd;
    const ratio = current / limit;
    const threshold = budget.alertThreshold;

    if (ratio >= threshold) {
      alerts.push({
        category,
        service,
        current: current.toFixed(2),
        limit: limit.toFixed(2),
        ratio: (ratio * 100).toFixed(1) + "%",
        severity: ratio >= 0.9 ? "critical" : "warning",
      });
    }

    // Check daily increase
    const prev = costs[service]?.prevUsd || 1;
    const dailyIncrease = (current - prev) / prev;
    if (dailyIncrease >= config.alerts.thresholds.cumulativeDailyIncrease) {
      alerts.push({
        category,
        service,
        message: `Daily increase: ${(dailyIncrease * 100).toFixed(1)}%`,
        severity: "warning",
      });
    }
  }

  return alerts;
}

async function sendAlert(alerts) {
  const payload = {
    text: `🚨 Cost Alert: ${alerts.length} threshold(s) exceeded`,
    attachments: alerts.map((a) => ({
      color: a.severity === "critical" ? "danger" : "warning",
      fields: [
        { title: "Service", value: `${a.category}/${a.service}`, short: true },
        { title: "Current", value: `$${a.current}`, short: true },
        { title: "Limit", value: `$${a.limit}`, short: true },
        { title: "Usage", value: a.ratio, short: true },
      ],
    })),
  };

  if (process.env.SLACK_WEBHOOK_URL) {
    // POST to Slack (implementation would use fetch)
    log(`[ALERT] Would send to Slack: ${JSON.stringify(payload)}`);
  }

  log("Alerts:", JSON.stringify(alerts, null, 2));
}

async function main() {
  const NOTIFY = process.argv.includes("--notify");
  log("Starting cost monitoring...");

  const config = JSON.parse(loadConfig());
  const allAlerts = [];

  // Check each category
  const supabaseCosts = await getSupabaseCosts();
  allAlerts.push(...checkThresholds("supabase", supabaseCosts, config));

  const redisCosts = await getRedisCosts();
  allAlerts.push(...checkThresholds("redis", redisCosts, config));

  if (allAlerts.length > 0) {
    log(`Found ${allAlerts.length} alert(s)`);
    if (NOTIFY) {
      await sendAlert(allAlerts);
    }
  } else {
    log("All costs within thresholds");
  }
}

main().catch((err) => {
  log(`Error: ${err.message}`);
  process.exit(1);
});
