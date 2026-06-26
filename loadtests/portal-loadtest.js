// Arch-Systems Load Testing Suite with k6
// PURPOSE: Performance and load testing for production readiness
// USAGE: k6 run loadtests/portal-loadtest.js
// SEE: https://k6.io/docs/
/* eslint-disable no-undef */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate("errors");
const loginDuration = new Trend("login_duration");
const dashboardLoadDuration = new Trend("dashboard_load_duration");
const apiResponseTime = new Trend("api_response_time");

// ── Test Configuration ──────────────────────────────────────────────────────
export const options = {
  // Scenarios for different load patterns
  scenarios: {
    // Smoke test - quick sanity check
    smoke: {
      executor: "constant-vus",
      vus: 5,
      duration: "1m",
      gracefulStop: "30s",
      tags: { test_type: "smoke" },
    },

    // Load test - typical production load
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "3m", target: 50 }, // Ramp up to 50 users
        { duration: "10m", target: 50 }, // Stay at 50 users
        { duration: "2m", target: 0 }, // Ramp down
      ],
      gracefulRampDown: "30s",
      tags: { test_type: "load" },
      exec: "loadTest",
    },

    // Stress test - breaking point
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 50 },
        { duration: "5m", target: 100 },
        { duration: "10m", target: 200 },
        { duration: "5m", target: 300 },
        { duration: "10m", target: 300 },
        { duration: "5m", target: 0 },
      ],
      gracefulRampDown: "30s",
      tags: { test_type: "stress" },
      exec: "stressTest",
    },

    // Spike test - sudden traffic surge
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "1m", target: 200 }, // Spike to 200 users
        { duration: "5m", target: 200 },
        { duration: "1m", target: 10 },
        { duration: "2m", target: 10 },
      ],
      tags: { test_type: "spike" },
      exec: "spikeTest",
    },

    // Soak test - long-running stability
    soak: {
      executor: "constant-vus",
      vus: 30,
      duration: "1h",
      tags: { test_type: "soak" },
      exec: "soakTest",
    },
  },

  // Thresholds for pass/fail
  thresholds: {
    http_req_failed: ["rate<0.01"], // Error rate < 1%
    http_req_duration: ["p(50)<500", "p(90)<1000", "p(95)<2000"], // Response time thresholds
    errors: ["rate<0.01"],
    login_duration: ["avg<1000", "p(95)<2000"],
    dashboard_load_duration: ["avg<2000", "p(95)<4000"],
    api_response_time: ["avg<300", "p(95)<800"],
  },

  // Summary trend stats
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ── Test Data ───────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// ── Helpers ─────────────────────────────────────────────────────────────────
function getRandomUser() {
  const users = [
    { email: "drilling@plantcor.os", password: "Drilling123!" },
    { email: "production@plantcor.os", password: "Production123!" },
    { email: "safety@plantcor.os", password: "Safety123!" },
    { email: "engineering@plantcor.os", password: "Engineering123!" },
  ];
  return users[Math.floor(Math.random() * users.length)];
}

function login(session) {
  const user = getRandomUser();

  const loginStart = Date.now();

  // Get CSRF token
  const loginPage = session.get(`${BASE_URL}/login`);
  check(loginPage, {
    "login page loaded": (r) => r.status === 200,
  });

  // Extract CSRF token (simplified - adjust based on actual implementation)
  const csrfToken = loginPage.cookies["csrf_token"] || "";

  // Login request
  const loginRes = session.post(
    `${BASE_URL}/api/auth/login`,
    {
      email: user.email,
      password: user.password,
      csrf_token: csrfToken,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const loginTime = Date.now() - loginStart;
  loginDuration.add(loginTime);

  check(loginRes, {
    "login successful": (r) => r.status === 200 || r.status === 302,
    "received auth token": (r) => r.json()?.token || r.headers["set-cookie"],
  });

  return session;
}

// ── Scenarios ───────────────────────────────────────────────────────────────

// Default scenario - smoke test
export default function smokeTest() {
  const session = http.session();
  session.setUserAgent("k6-load-test");

  // Health check
  const healthRes = session.get(`${BASE_URL}/api/health`);
  const healthOk = check(healthRes, {
    "health check passes": (r) => r.status === 200 && r.json()?.status === "healthy",
  });
  errorRate.add(!healthOk);

  sleep(1);

  // Home page
  const homeRes = session.get(`${BASE_URL}/`);
  check(homeRes, {
    "home page loads": (r) => r.status === 200,
    "home page under 2s": (r) => r.timings.duration < 2000,
  });

  sleep(2);
}

// Load test scenario
export function loadTest() {
  const session = http.session();
  session.setUserAgent("k6-load-test");

  // Login
  login(session);
  sleep(2);

  // Access dashboard
  const dashboardStart = Date.now();
  const dashboardRes = session.get(`${BASE_URL}/dashboard`);
  const dashboardTime = Date.now() - dashboardStart;
  dashboardLoadDuration.add(dashboardTime);

  check(dashboardRes, {
    "dashboard loads": (r) => r.status === 200,
    "dashboard under 3s": (r) => r.timings.duration < 3000,
  });

  sleep(3);

  // Access department page
  const deptRes = session.get(`${BASE_URL}/departments/drilling`);
  check(deptRes, {
    "department page loads": (r) => r.status === 200,
  });

  sleep(2);
}

// Stress test scenario
export function stressTest() {
  loadTest();

  // Additional API calls under stress
  const session = http.session();
  const apiRes = session.get(`${BASE_URL}/api/employees`);
  const apiTime = apiRes.timings.duration;
  apiResponseTime.add(apiTime);

  check(apiRes, {
    "API responds": (r) => r.status === 200,
    "API under 500ms": (r) => r.timings.duration < 500,
  });
}

// Spike test scenario
export function spikeTest() {
  loadTest();
}

// Soak test scenario
export function soakTest() {
  loadTest();

  // Periodic health checks during soak
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    "health check stable": (r) => r.status === 200,
  });
}

// ── Browser Test (requires k6 browser) ──────────────────────────────────────
// Uncomment and use with: k6 run --out json=results.json loadtests/portal-loadtest.js
/*
import { browser } from 'k6/browser';

export const browserOptions = {
  scenarios: {
    ui: {
      executor: 'constant-vus',
      exec: 'browserTest',
      vus: 5,
      duration: '5m',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
};

export async function browserTest() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { email, password } = getRandomUser();

  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([
      page.waitForNavigation(),
      page.click('button[type="submit"]'),
    ]);

    check(page, {
      'logged in successfully': (p) => p.url().includes('/dashboard'),
    });

    await page.goto(`${BASE_URL}/dashboard`);
    check(page, {
      'dashboard renders': (p) => p.locator('h1').textContent() === 'Dashboard',
    });
  } finally {
    await page.close();
  }
}
*/
